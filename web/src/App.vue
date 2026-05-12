<template>
  <div id="app">
    <nav>
      <router-link to="/">配置</router-link>
      <router-link to="/ai">AI 配置</router-link>
      <router-link to="/projects">项目</router-link>
      <router-link to="/generate">生成</router-link>
    </nav>
    <main>
      <router-view />
    </main>
  </div>
</template>

<style>
nav {
  padding: 1rem;
  background: #f5f5f5;
}
nav a {
  margin-right: 1rem;
}
</style>
