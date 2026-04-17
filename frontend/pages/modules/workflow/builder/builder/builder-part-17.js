const t = window.workflowBuilderT || ((key, fallback) => fallback || key);

logoInput.addEventListener("change", (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const entry = {
        name: file.name.replace(".svg", ""),
        data: reader.result
      };
      logoLibrary.push(entry);
      renderLogoList();
    };
    reader.readAsDataURL(file);
  });
  event.target.value = "";
});

function renderLogoList() {
  logoList.innerHTML = "";
  logoLibrary.forEach((logo) => {
    const row = document.createElement("div");
    row.className = "logo-item";
    const img = document.createElement("img");
    img.src = logo.data;
    img.alt = logo.name;
    const button = document.createElement("button");
    button.className = "shape-btn";
    button.textContent = t("common.insert", "Inserer");
    button.addEventListener("click", () => {
      const id = generateId("shape");
      const shape = {
        id,
        type: "logo",
        x: 120,
        y: 120,
        width: 120,
        height: 80,
        text: "",
        fontSize: 12,
        fontFamily: "Segoe UI",
        textColor: "#1f2933",
        bgColor: "#ffffff",
        opacity: 1,
        group: "",
        imageData: logo.data
      };
      shapes.push(shape);
      renderShapes();
      selectShape(id);
    });
    const label = document.createElement("span");
    label.textContent = logo.name;
    row.appendChild(img);
    row.appendChild(label);
    row.appendChild(button);
    logoList.appendChild(row);
  });
}
