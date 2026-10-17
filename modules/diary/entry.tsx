import React from 'react';import{createRoot}from'react-dom/client';import DiaryApp from './app/ui';import './app/globals.css';import './embedded.css';
createRoot(document.getElementById('root')!).render(<DiaryApp name="Engefex"/>);
