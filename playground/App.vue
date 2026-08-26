<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()
const count = ref(2)
const questions = computed(() => t('faq.questions').split(',,'))
const features = computed(() => JSON.parse(t('note.features')) as string[])
</script>

<template>
  <main>
    <p>Press <kbd>Alt</kbd> three times, then hold it and point at any text:</p>

    <section class="app">
      <h1>{{ t('hero.header') }}</h1>
      <button type="button">{{ t('hero.cta') }}</button>
      <p>{{ t('greeting', { name: 'Ada' }) }}</p>
      <p>{{ t('cart.count', count) }}</p>

      <ul>
        <li v-for="question in questions" :key="question">{{ question.trim() }}</li>
      </ul>
      <ul>
        <li v-for="feature in features" :key="feature">{{ feature }}</li>
      </ul>

      <a href="/" :aria-label="t('nav.home')">{{ t('nav.home') }}</a>
    </section>

    <p>
      <button type="button" @click="count += 1">Add a note</button>
      <button type="button" @click="locale = locale === 'en' ? 'es' : 'en'">
        Switch language
      </button>
    </p>
  </main>
</template>

<style>
main { font: 16px system-ui; margin: 2rem auto; max-width: 40rem; }
.app {
  padding: 1rem;
  border: 1px solid #93c5fd;
  border-radius: 10px;
}
.app h1 { margin-top: 0; }
button { margin-right: 0.5rem; }
</style>
