import { writable } from 'svelte/store';

export const courses = writable(null);


export async function getCourses() {
        const data = await fetch(`/courses/index.json`).then(r => r.json());
        courses.set(data);
}
