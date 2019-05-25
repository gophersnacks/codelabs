<script>
  import { sitedata } from "../stores/data";
  import  Snack  from "../components/Snack.svelte";
  export let snackname;
  let snack;
  $: {
    if ($sitedata !== null) {
      $sitedata.data.items.forEach(item => {
        if (item.permalink === '/snacks/' + snackname +'/') {
          snack = item;
        }
      });
    }
  }
</script>

<Snack {snack} />