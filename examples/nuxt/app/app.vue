<script setup lang="ts">
import { computed, ref } from "vue";
import * as s from "./page.styles";

const open = ref(false);
const parts = computed(() => s.panel({ tone: open.value ? "warn" : "info" }));
</script>

<template>
  <main :class="s.page">
    <h1 :class="s.title">tailess on Nuxt</h1>
    <button
      type="button"
      :class="s.toggle"
      :data-state="open ? 'open' : 'closed'"
      @click="open = !open"
    >
      {{ open ? "Close" : "Open" }}
    </button>
    <section :class="parts.root">
      <h2 :class="parts.heading">Rendered on the server, built again in the browser</h2>
      <p :class="s.note(open)">Every class on this page comes from app/page.styles.ts.</p>
    </section>
  </main>
</template>
