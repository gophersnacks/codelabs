<script>
  import { onMount } from "svelte";
  export let snack;
</script>

<style>
  .tile.is-parent {
    padding: 0.75rem;
    padding-top: 0.75rem;
    padding-right: 0.75rem;
    padding-bottom: 0.75rem;
    padding-left: 0.75rem;
  }
</style>

<section class="section">
  <div class="container">
      <div class="tile is-ancestor">
          <div class="tile is-4 is-parent">
            <div class="tile is-child">
              <article class="tile is-child notification is-success">
                <p class="title">
                <span class="icon">
                  <i class="fas fa-cookie-bite" />
                </span>
                   {snack.title}
                </p>
                <div class="content"> {snack.description} </div>
                <div class="tags">
                  {#each snack.categories.split(',') as category}
                    <span class="tag">#{category}</span>
                  {/each}
                </div>
                <a class="button is-link is-fullwidth" href={snack.permalink}>
                  View
                </a>
              </article>
            </div>
          </div>
      </div>
  </div>
</section>
