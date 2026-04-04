import { defineConfig } from "vite";

import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        auth: resolve(__dirname, 'pages/auth.html'),
        dashboard: resolve(__dirname, 'pages/dashboard.html'),
        profile: resolve(__dirname, 'pages/profile.html'),
        projects: resolve(__dirname, 'pages/projects.html'),
        teams: resolve(__dirname, 'pages/teams.html'),
        teammates: resolve(__dirname, 'pages/find-teammates.html'),
        leaderboard: resolve(__dirname, 'pages/leaderboard.html'),
        daily_challenge: resolve(__dirname, 'pages/daily-challenge.html'),
        messages: resolve(__dirname, 'pages/messages.html'),
        community_picker: resolve(__dirname, 'pages/community-picker.html'),
      }
    }
  }
});
