import { writable } from 'svelte/store';

export const snacks = writable(null);


export async function getSnacks() {
        const data = await fetch(`/snacks/index.json`).then(r => r.json());
        snacks.set(data);
}
