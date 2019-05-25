import { writable } from 'svelte/store';

export const tutorials = writable(null);


export async function getTutorials() {
        const data = await fetch(`/tutorials/index.json`).then(r => r.json());
        tutorials.set(data);
}

