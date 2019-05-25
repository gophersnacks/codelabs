import App from "./App.svelte";

const app = new App({
  target: document.body,
  props: {
    title: document.title
  }
});

export default app;
