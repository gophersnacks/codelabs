import App from "../../static/bundle";


const app = new App({
  target: document.body,
  props: {
    title: "{{site.Title}}"
  }
});

export default app;
