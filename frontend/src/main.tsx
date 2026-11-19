import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@retrest/design-tokens/react';
import '@retrest/design-tokens/theme.css';
import '@retrest/design-tokens/base.css';
import './styles.css';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ThemeProvider><App /></ThemeProvider></React.StrictMode>);
