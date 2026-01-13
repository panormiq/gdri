export default class DocumentTemplateLoader {
  static async loadFromJson(path) {
    const res = await fetch(path);

    if (!res.ok) {
      throw new Error(`Impossible de charger le template : ${path}`);
    }

    return await res.json();
  }
}
