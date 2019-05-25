<script>
  import { Link } from "svelte-routing";
  export let title;
</script>

<nav class="navbar" role="navigation" aria-label="main navigation">
  <div class="navbar-brand">
      <span class="navbar-item">
        <Link class="navbar-item" to="/"><h1>{title}</h1></Link>
      </span>

    <a
      role="button"
      class="navbar-burger burger"
      aria-label="menu"
      aria-expanded="false"
      data-target="navbarBasicExample">
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
    </a>
  </div>

  <div id="navbarBasicExample" class="navbar-menu">
    <div class="navbar-start">

      <span class="navbar-item">
        <Link class="navbar-item" to="/snacks">Snacks</Link>
      </span>
      <span class="navbar-item">
        <Link class="navbar-item" to="/tutorials">Tutorials</Link>
      </span>
      <span class="navbar-item">
        <Link class="navbar-item" to="/courses">Courses</Link>
      </span>
      <div class="navbar-item has-dropdown is-hoverable">
        <a class="navbar-link">More</a>

        <div class="navbar-dropdown">
          <span class="navbar-item">
            <Link class="navbar-item" to="/about">About</Link>
          </span>
          <a class="navbar-item">Contact</a>
          <hr class="navbar-divider" />
          <a class="navbar-item">Report an issue</a>
        </div>
      </div>
    </div>

    <div class="navbar-end">
      <div class="navbar-item">
        <div class="buttons">
          <a class="button is-primary">
            <strong>Sign up</strong>
          </a>
          <a class="button is-light">Log in</a>
        </div>
      </div>
    </div>
  </div>
</nav>
