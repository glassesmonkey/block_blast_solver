import React from 'react';
import { createRoot } from 'react-dom/client';
import { BlockBlastSolver } from '../src/components/BlockBlastSolver';
import './popup.css';

console.log('Popup script loaded');

const root = createRoot(document.getElementById('root')!);
console.log('Root element found:', root);

root.render(<BlockBlastSolver />); 