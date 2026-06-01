import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import App from './App.jsx'
import './styles/index.css'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1e3a5f' },
    secondary: { main: '#475569' },
    background: { default: '#f4f6f9', paper: '#ffffff' },
    text: { primary: '#1a1a2e', secondary: '#64748b' },
  },
  typography: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', system-ui, 'Inter', 'Noto Sans SC', sans-serif",
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 600, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600, letterSpacing: '-0.01em' },
  },
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 8 }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, textTransform: 'none', fontWeight: 600 }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6 }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 700, fontSize: '0.875rem', color: '#1a1a2e' }
      }
    }
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
