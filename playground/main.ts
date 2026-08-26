import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import { startInspector } from '../src/index'
import { type ComposerLike, createVueI18nAdapter } from '../src/vue-i18n/index'
import App from './App.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {
      hero: { header: 'Keep every note in one place', cta: 'Start a note' },
      cart: { count: 'one note | {n} notes' },
      faq: { questions: 'Where do notes live?,, Can I share one?' },
      note: { features: '["Offline first","Instant search"]' },
      seo: { title: 'Save your note' },
      greeting: 'Hello {name}',
      nav: { home: 'Home' },
    },
    es: {
      hero: { header: 'Guarda tus notas en un lugar', cta: 'Escribe una nota' },
      cart: { count: 'una nota | {n} notas' },
      note: { features: '["Sin conexion","Busqueda al instante"]' },
      faq: { questions: 'Donde viven las notas?,, Puedo compartir una?' },
      seo: { title: 'Notas' },
      greeting: 'Hola {name}',
      nav: { home: 'Inicio' },
    },
  },
})

const app = createApp(App)
app.use(i18n)
app.mount('#app')

startInspector(createVueI18nAdapter(i18n.global as unknown as ComposerLike), {
  skipGroups: ['seo'],
  listSeparators: [',,'],
  formatKey: (key) => key.replace(/\./g, '::'),
})
