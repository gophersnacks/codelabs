<!-- App.svelte -->
<script>
  import { onMount } from 'svelte';
  import { Router, Link, Route } from "svelte-routing";

  import  Courses from "./views/Courses.svelte";
  import  Tutorials from "./views/Tutorials.svelte";
  import  Snacks from "./views/Snacks.svelte";
  import  About  from "./views/About.svelte";
  import  Home  from "./views/Home.svelte";
  import { getCourses } from "./stores/courses";

  import { getTutorials } from "./stores/tutorials";
  import { getSnacks } from "./stores/snacks";
  import  Banner from "./components/Banner.svelte";
  export let url = "";
  export let title = "";


  onMount(() => {
    getCourses();
    getTutorials();
    getSnacks();
  });

</script>

<Router url="{url}">
  <Banner {title} />
  <main>

    <Route path="tutorials" component="{Tutorials}" />
    <Route path="courses" component="{Courses}" />
    <Route path="snacks" component="{Snacks}" />
    <Route path="about" component="{About}" />
    <Route path="/"><Home /></Route>
  </main>
</Router>