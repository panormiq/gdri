// shared/ui/BaseCard.js
export default class BaseCard {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'card';
  }

  setHeader(content) {
    const h = document.createElement('div');
    h.className = 'card-header';
    h.append(content);
    this.el.appendChild(h);
  }

  setBody(content) {
    const b = document.createElement('div');
    b.className = 'card-body';
    b.append(content);
    this.el.appendChild(b);
  }

  setActions(actions = []) {
    const a = document.createElement('div');
    a.className = 'card-actions';
    actions.forEach(btn => a.append(btn));
    this.el.appendChild(a);
  }

  render() {
    return this.el;
  }
}
