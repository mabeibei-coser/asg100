// 36 场景检查清单（数据） + buildSystemPrompt + parseResult（函数）。
//
// 数据原本硬编码在本文件，2026-05-27 抽到 data/prompts.json 后变成运行时读取。
// admin-hub 可以编辑这个 JSON，下一次 /api/analyze 调用 buildSystemPrompt 时
// 自动用新内容（无需重启 hazard-detect 服务）。
//
// 加载策略：
//   - 启动时预读一次（失败直接抛，避免吞 bug）
//   - 后续每次 build 时用 mtime 判断是否需要重新读，常态零 I/O
//   - 读到的 JSON schema 不合法 → 用上次缓存 + 控制台告警，业务不挂

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_PATH = path.join(__dirname, "..", "data", "prompts.json");

let _cache = null; // { labels, prompts, mtimeMs }

function loadPrompts() {
  let stat;
  try {
    stat = fs.statSync(PROMPTS_PATH);
  } catch (err) {
    if (_cache) {
      console.error("[prompts] stat failed, using cached:", err.message);
      return _cache;
    }
    throw new Error(
      `prompts.json 缺失：${PROMPTS_PATH}。首次部署请 cp data/prompts.seed.json data/prompts.json`,
    );
  }
  if (_cache && _cache.mtimeMs === stat.mtimeMs) return _cache;

  try {
    const raw = fs.readFileSync(PROMPTS_PATH, "utf8");
    const data = JSON.parse(raw);
    if (
      !data ||
      typeof data.labels !== "object" ||
      typeof data.prompts !== "object"
    ) {
      throw new Error("schema invalid: 期望 { labels, prompts }");
    }
    _cache = {
      labels: data.labels,
      prompts: data.prompts,
      mtimeMs: stat.mtimeMs,
    };
    return _cache;
  } catch (err) {
    if (_cache) {
      console.error(
        "[prompts] reload failed, keeping last good version:",
        err.message,
      );
      return _cache;
    }
    throw err;
  }
}

// 启动时预加载 —— 验证 JSON 可读，否则服务起不来
loadPrompts();

// 为了不动 server.js（它 `import { SCENARIO_LABELS }` 后用 SCENARIO_LABELS[k]），
// 用 Proxy 把"对象属性访问"转成"调用 loader"。
export const SCENARIO_LABELS = new Proxy(
  {},
  {
    get(_, k) {
      return loadPrompts().labels[k];
    },
    has(_, k) {
      return k in loadPrompts().labels;
    },
    ownKeys() {
      return Object.keys(loadPrompts().labels);
    },
    getOwnPropertyDescriptor(_, k) {
      return {
        enumerable: true,
        configurable: true,
        value: loadPrompts().labels[k],
      };
    },
  },
);

export const SCENARIO_PROMPTS = new Proxy(
  {},
  {
    get(_, k) {
      return loadPrompts().prompts[k];
    },
    has(_, k) {
      return k in loadPrompts().prompts;
    },
    ownKeys() {
      return Object.keys(loadPrompts().prompts);
    },
    getOwnPropertyDescriptor(_, k) {
      return {
        enumerable: true,
        configurable: true,
        value: loadPrompts().prompts[k],
      };
    },
  },
);

// ──────── 业务函数（行为与重构前一致） ────────

export const buildSystemPrompt = (scenario) => {
  const cfg = SCENARIO_PROMPTS[scenario] || SCENARIO_PROMPTS.general;
  const isGeneral = scenario === "general";

  let focusList = cfg.focus.map((f, i) => `${i + 1}. ${f}`).join("\n");

  if (!isGeneral) {
    const generalFocus = SCENARIO_PROMPTS.general.focus;
    const offset = cfg.focus.length;
    const generalList = generalFocus
      .map((f, i) => `${offset + i + 1}. ${f}`)
      .join("\n");
    focusList = `【${cfg.name}专项检查项】\n${focusList}\n\n【通用消防安全检查项】\n${generalList}`;
  }

  return `你是一名持有国家注册安全工程师资格的高级安全专家，具有20年安全管理经验，熟悉各类国家标准和行业规范。

【当前检查场景】${cfg.name}
【场景背景】${cfg.context}

【核心原则】
只报告照片中能够直接观察到的安全隐患，不得推测或报告照片中不可见的内容。
例如：能看到电线裸露、灭火器指针不在绿区、防护栏缺失 → 可以报告。
不能看到制度文件、培训记录、应急预案内容 → 不得报告。

【重点检查清单 — 照片可识别项】
${focusList}

【分析要求】
1. 仔细观察照片的每一个细节，从上述清单逐一比对
2. 识别 1 到 3 个最明确、最严重的安全隐患（如果实际隐患少于 3 个则只输出实际存在的）
3. 按严重程度从高到低排列
4. 每个隐患引用具体的国家标准或行业规范条款
5. 整改建议必须具体、可操作，分步骤说明
6. 预算经费要合理估算，给出具体金额范围（人民币元）

【输出格式 — JSON 数组，严格按此格式】
[
  {
    "hazard_name": "隐患名称（15字以内，简洁精准）",
    "hazard_level": "高|中|低",
    "hazard_description": "描述照片中能看到的隐患位置、表现形式和可能后果（100-200字）",
    "relevant_regulations": "引用具体规范编号和条款，如：GB 50016-2014 第X.X.X条",
    "rectification_suggestions": "1. 第一步整改措施\\n2. 第二步整改措施\\n3. 第三步整改措施",
    "estimated_budget": "¥X,XXX - Y,YYY 元 （含材料费和人工费）"
  }
]

【隐患等级判定标准】
- 高：可能导致人员死亡、重伤或重大财产损失
- 中：可能导致人员轻伤或一般财产损失
- 低：轻微风险，存在改进空间但不会立即造成伤害

【重要】
- 只输出 JSON 数组，不要输出任何其他文字
- 确保 JSON 格式正确，可被程序直接解析
- 如果照片中确实没有发现明显隐患，输出空数组 []`;
};

export const parseResult = (content) => {
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const arr = JSON.parse(jsonMatch[0]);
      if (Array.isArray(arr) && arr.length > 0) {
        return arr.map((item) => {
          const fields = [
            "hazard_name",
            "hazard_level",
            "hazard_description",
            "relevant_regulations",
            "rectification_suggestions",
            "estimated_budget",
          ];
          fields.forEach((f) => {
            if (!item[f]) item[f] = "未提供";
          });
          if (!["高", "中", "低"].includes(item.hazard_level))
            item.hazard_level = "中";
          return item;
        });
      }
    }
    throw new Error("格式异常");
  } catch {
    return [
      {
        hazard_name: "安全隐患",
        hazard_level: "中",
        hazard_description: content.substring(0, 300),
        relevant_regulations: "请专业人员进行详细评估",
        rectification_suggestions: "1. 请安全专业人员进行现场评估",
        estimated_budget: "待评估",
      },
    ];
  }
};
