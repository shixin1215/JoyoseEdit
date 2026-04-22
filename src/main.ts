import { createApp } from 'vue';
import App from './App.vue';
import { initTheme } from '@/state/theme';
import './styles/main.css';

initTheme();
createApp(App).mount('#app');
