<script>
  import { onMount } from "svelte";
  import { snacks} from '../stores/snacks';
  export let title;
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
    {#if $snacks}
      <div class="tile is-ancestor">
        {#each $snacks.data.items as item}
          <div class="tile is-4 is-parent">
            <div class="tile is-child">
              <article class="tile is-child notification is-success">
                <p class="title">
                <span class="icon">
                  <i class="fas fa-cookie-bite" />
                </span>
                   {item.title}
                </p>
                <div class="content"> {item.description} </div>
                <div class="tags">
                  {#each item.categories.split(',') as category}
                    <span class="tag">#{category}</span>
                  {/each}
                </div>
                <a class="button is-link is-fullwidth" href={item.permalink}>
                  View
                </a>
              </article>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</section>
