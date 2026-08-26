/** The inspector throws this when it runs outside a browser. */
export class NoDocumentError extends Error {
  constructor() {
    super('i18n-key-inspector needs a document; start it on the client only')
    this.name = 'NoDocumentError'
  }
}
