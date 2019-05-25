import { derived, writable } from 'svelte/store';

export const sitedata = writable(null);

export async function getSitedata() {
        const data = await fetch(`/index.json`).then(r => r.json());
        sitedata.set(data);
}

