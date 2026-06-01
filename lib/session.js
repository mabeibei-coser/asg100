import { getIronSession } from "iron-session";

export const sessionOptions = {
  password: process.env.ASG100_SESSION_PASSWORD,
  cookieName: "asg100_user_session",
  cookieOptions: {
    secure:
      process.env.ASG100_COOKIE_SECURE !== "false" &&
      process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: process.env.ASG100_COOKIE_PATH || "/",
    maxAge: 60 * 60 * 24 * 30,
  },
};

export async function getSession(req, res) {
  if (!sessionOptions.password) {
    throw new Error("ASG100_SESSION_PASSWORD env 未配置");
  }
  return getIronSession(req, res, sessionOptions);
}
