// src/modules/editor/template/document/DocumentTemplateLoader.js

export default class DocumentTemplateLoader {

  static async load(url) {
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Impossible de charger le template : ${url}`);
    }

    return await res.json();
  }

}
