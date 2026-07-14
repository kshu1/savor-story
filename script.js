const starterRecipes = [];

const STORAGE_KEY = "savor-story-custom-recipes-v2";
const CATEGORY_STORAGE_KEY = "savor-story-categories-v1";
const SESSION_KEY = "savor-story-admin";
const fallbackImage = "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=82";
const DEFAULT_CATEGORIES = ["Vegetarian", "Weeknight", "Baking", "Dessert", "Quick & easy"];

let customRecipes = loadCustomRecipes();
let recipes = [...customRecipes, ...starterRecipes];
let categories = loadCategories();
let activeFilter = "All";
let searchTerm = "";
let toastTimer;

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

function loadCustomRecipes() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveCustomRecipes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customRecipes));
}

function loadCategories() {
  try {
    const saved = JSON.parse(localStorage.getItem(CATEGORY_STORAGE_KEY) || "null");
    const valid = Array.isArray(saved) ? saved.map(normalizeCategory).filter(Boolean) : [];
    return valid.length ? [...new Set(valid)] : [...DEFAULT_CATEGORIES];
  } catch {
    return [...DEFAULT_CATEGORIES];
  }
}

function saveCategories() {
  localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories));
}

function normalizeCategory(value = "") {
  return String(value).trim().replace(/\s+/g, " ").slice(0, 32);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function safeImageUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : fallbackImage;
  } catch {
    return fallbackImage;
  }
}

function refreshRecipes() {
  recipes = [...customRecipes, ...starterRecipes];
  renderCategoryOptions();
  renderFilterButtons();
  renderRecipeGrid();
  renderAdminContent();
  renderCategoryManager();
}

function renderCategoryOptions() {
  ["#quickCategory", "#recipeCategory"].forEach(selector => {
    const select = $(selector);
    if (!select) return;
    const selected = categories.includes(select.value) ? select.value : categories[0];
    select.innerHTML = categories.map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join("");
    select.value = selected;
  });
}

function renderFilterButtons() {
  const filterRow = $("#filterRow");
  if (!filterRow) return;
  if (activeFilter !== "All" && !categories.includes(activeFilter)) activeFilter = "All";
  filterRow.innerHTML = ["All", ...categories].map(category => `
    <button class="${category === activeFilter ? "active" : ""}" type="button" data-filter="${escapeHTML(category)}">${category === "All" ? "All recipes" : escapeHTML(category)}</button>`).join("");
}

function renderCategoryManager() {
  const list = $("#adminCategoryList");
  if (!list) return;
  list.innerHTML = categories.map((category, index) => `
    <div class="admin-category-row" data-category-index="${index}">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <input type="text" value="${escapeHTML(category)}" maxlength="32" aria-label="Category name ${escapeHTML(category)}">
      <button class="category-save" type="button" data-update-category="${index}">Save</button>
      <button class="category-delete" type="button" data-remove-category="${index}" aria-label="Delete ${escapeHTML(category)}" ${categories.length === 1 ? "disabled" : ""}><svg><use href="#i-trash"/></svg></button>
    </div>`).join("");
  $("#sidebarCategoryCount").textContent = categories.length;
  $("#categoryUsageNote").textContent = `${categories.length} ${categories.length === 1 ? "category" : "categories"}`;
}

function setCategoryError(message = "") {
  const error = $("#categoryError");
  if (error) error.textContent = message;
}

function categoryExists(name, ignoredIndex = -1) {
  return categories.some((category, index) => index !== ignoredIndex && category.toLocaleLowerCase() === name.toLocaleLowerCase());
}

function addCategory(name) {
  const category = normalizeCategory(name);
  if (!category) return setCategoryError("Enter a category name.");
  if (categoryExists(category)) return setCategoryError("That category already exists.");
  categories.push(category);
  saveCategories();
  refreshRecipes();
  setCategoryError("");
  $("#newCategoryName").value = "";
  showToast("Category added", `${category} is ready to use.`);
}

function updateCategory(index) {
  const row = $(`.admin-category-row[data-category-index="${index}"]`);
  const field = $("input", row);
  const category = normalizeCategory(field.value);
  const previous = categories[index];
  if (!category) return setCategoryError("A category name cannot be empty.");
  if (categoryExists(category, index)) return setCategoryError("That category already exists.");
  if (category === previous) return;
  categories[index] = category;
  customRecipes = customRecipes.map(recipe => recipe.category === previous ? { ...recipe, category } : recipe);
  saveCategories();
  saveCustomRecipes();
  refreshRecipes();
  setCategoryError("");
  showToast("Category updated", `${previous} is now ${category}.`);
}

function removeCategory(index) {
  if (categories.length === 1) return setCategoryError("Keep at least one category available for recipes.");
  const removed = categories[index];
  const replacement = categories[index === 0 ? 1 : 0];
  categories.splice(index, 1);
  customRecipes = customRecipes.map(recipe => recipe.category === removed ? { ...recipe, category: replacement } : recipe);
  if (activeFilter === removed) activeFilter = "All";
  saveCategories();
  saveCustomRecipes();
  refreshRecipes();
  setCategoryError("");
  showToast("Category removed", `${removed} recipes now use ${replacement}.`);
}

function recipeCardTemplate(recipe) {
  return `
    <article class="recipe-card" data-recipe-id="${escapeHTML(recipe.id)}" tabindex="0">
      <div class="recipe-card-image">
        <img src="${safeImageUrl(recipe.image)}" alt="${escapeHTML(recipe.title)}" loading="lazy">
        <span class="card-category">${escapeHTML(recipe.category)}</span>
        <button class="save-button" type="button" data-save-id="${escapeHTML(recipe.id)}" aria-label="Save ${escapeHTML(recipe.title)}"><svg><use href="#i-bookmark"/></svg></button>
        ${recipe.custom ? '<span class="new-badge">Just published</span>' : ""}
      </div>
      <div class="recipe-card-content">
        <div class="recipe-meta"><span><svg><use href="#i-clock"/></svg>${escapeHTML(recipe.time)}</span><i></i><span>Serves ${escapeHTML(recipe.servings)}</span></div>
        <h3>${escapeHTML(recipe.title)}</h3>
        <p>${escapeHTML(recipe.description)}</p>
      </div>
    </article>`;
}

function filteredRecipes() {
  return recipes.filter(recipe => {
    const matchesFilter = activeFilter === "All" || recipe.category === activeFilter;
    const haystack = `${recipe.title} ${recipe.category} ${recipe.description}`.toLowerCase();
    return matchesFilter && haystack.includes(searchTerm.toLowerCase());
  });
}

function renderRecipeGrid() {
  const visible = filteredRecipes();
  $("#recipeGrid").innerHTML = visible.map(recipeCardTemplate).join("");
  const emptyState = $("#emptyState");
  emptyState.hidden = visible.length > 0;
  if (!visible.length) {
    const isCollectionEmpty = recipes.length === 0;
    $("span", emptyState).textContent = isCollectionEmpty ? "Your recipe collection is empty." : "No recipes match this filter.";
    $("p", emptyState).textContent = isCollectionEmpty ? "Sign in to the kitchen dashboard and publish your first recipe." : "Choose another category or clear your search.";
    $("[data-view-target]", emptyState).hidden = !isCollectionEmpty;
  }
}

function renderAdminContent() {
  const recent = recipes.slice(0, 4);
  $("#recentAdminRecipes").innerHTML = recent.length ? recent.map(recipe => `
    <article class="admin-recipe-item">
      <img src="${safeImageUrl(recipe.image)}" alt="">
      <div><strong>${escapeHTML(recipe.title)}</strong><small>${escapeHTML(recipe.category)} · ${escapeHTML(recipe.time)}</small></div>
      <span class="status-pill">Live</span>
    </article>`).join("") : '<div class="admin-empty">No recipes yet. Use quick publish to add your first one.</div>';

  $("#recipeTableBody").innerHTML = recipes.length ? recipes.map(recipe => `
    <tr>
      <td><div class="table-recipe"><img src="${safeImageUrl(recipe.image)}" alt=""><strong>${escapeHTML(recipe.title)}</strong></div></td>
      <td>${escapeHTML(recipe.category)}</td><td>${escapeHTML(recipe.time)}</td><td><span class="status-pill">Published</span></td>
      <td>${recipe.custom ? `<button class="delete-recipe" type="button" data-delete-id="${escapeHTML(recipe.id)}" aria-label="Delete ${escapeHTML(recipe.title)}"><svg><use href="#i-trash"/></svg></button>` : ""}</td>
    </tr>`).join("") : '<tr><td class="admin-empty-row" colspan="5">No recipes published yet.</td></tr>';

  $("#sidebarRecipeCount").textContent = recipes.length;
  $("#totalRecipesMetric").textContent = recipes.length;
}

function showView(name, updateHash = true) {
  $$(".app-view").forEach(view => view.classList.remove("active"));
  const view = $(`#${name}View`);
  if (!view) return;
  view.classList.add("active");
  document.body.classList.remove("modal-open");
  $(".mobile-nav")?.classList.remove("open");
  $(".mobile-menu-toggle")?.setAttribute("aria-expanded", "false");
  $(".admin-sidebar")?.classList.remove("open");
  window.scrollTo(0, 0);
  if (updateHash) history.replaceState(null, "", name === "home" ? "#home" : `#${name}`);
}

function openAdminPanel(panel) {
  const available = ["overview", "editor", "recipes", "categories"];
  if (panel === "settings") {
    showToast("Settings", "This demo keeps your preferences in the browser.");
    return;
  }
  if (!available.includes(panel)) return;
  $$(".admin-panel").forEach(item => item.classList.remove("active"));
  $(`#${panel}Panel`).classList.add("active");
  $$("[data-admin-panel]").forEach(button => button.classList.toggle("active", button.dataset.adminPanel === panel && button.closest(".admin-sidebar")));
  const titles = { overview: "Good morning, Amelia.", editor: "Create something delicious.", recipes: "Your recipe library.", categories: "Keep your recipes organised." };
  $("#adminTitle").textContent = titles[panel];
  $(".admin-sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openRecipe(id) {
  const recipe = recipes.find(item => item.id === id);
  if (!recipe) return;
  $("#modalRecipeImage").src = safeImageUrl(recipe.image);
  $("#modalRecipeImage").alt = recipe.title;
  $("#modalRecipeCategory").textContent = recipe.category;
  $("#modalRecipeTitle").textContent = recipe.title;
  $("#modalRecipeTime").textContent = recipe.time;
  $("#modalRecipeServings").textContent = recipe.servings;
  $("#modalRecipeDescription").textContent = recipe.description;
  $("#recipeModal").classList.add("open");
  $("#recipeModal").setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  $(".modal-close").focus();
}

function closeRecipeModal() {
  $("#recipeModal").classList.remove("open");
  $("#recipeModal").setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function showToast(title, message) {
  clearTimeout(toastTimer);
  $("#toastTitle").textContent = title;
  $("#toastMessage").textContent = message;
  $("#toast").classList.add("show");
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3500);
}

function updatePreview() {
  const title = $("#recipeTitle").value.trim() || "Your recipe title";
  const category = $("#recipeCategory").value;
  const time = $("#recipeTime").value.trim() || "45 min";
  const description = $("#recipeDescription").value.trim() || "Your short recipe introduction will appear here.";
  const image = safeImageUrl($("#recipeImage").value.trim());
  $("#previewTitle").textContent = title;
  $("#previewCategory").textContent = category;
  $("#previewTime").textContent = time;
  $("#previewDescription").textContent = description;
  $("#previewImage").src = image;
  $("#descriptionCount").textContent = $("#recipeDescription").value.length;
}

function publishRecipe(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const title = $("#recipeTitle").value.trim();
  const newRecipe = {
    id: `custom-${Date.now()}`,
    title,
    category: $("#recipeCategory").value,
    time: $("#recipeTime").value.trim(),
    servings: Number($("#recipeServings").value),
    description: $("#recipeDescription").value.trim().slice(0, 220),
    image: safeImageUrl($("#recipeImage").value.trim()),
    featured: false,
    saves: 0,
    custom: true,
    createdAt: new Date().toISOString()
  };
  customRecipes.unshift(newRecipe);
  saveCustomRecipes();
  refreshRecipes();
  form.reset();
  $("#recipeServings").value = 4;
  updatePreview();
  openAdminPanel("recipes");
  showToast("Recipe published", `${title} is now live on your website.`);
}

document.addEventListener("click", event => {
  const viewButton = event.target.closest("[data-view-target]");
  if (viewButton) {
    event.preventDefault();
    const target = viewButton.dataset.viewTarget;
    if (target === "admin" && sessionStorage.getItem(SESSION_KEY) !== "true") showView("login");
    else showView(target);
    return;
  }

  const adminButton = event.target.closest("[data-admin-panel]");
  if (adminButton) {
    openAdminPanel(adminButton.dataset.adminPanel);
    return;
  }

  const saveButton = event.target.closest("[data-save-id]");
  if (saveButton) {
    event.stopPropagation();
    saveButton.classList.toggle("saved");
    showToast(saveButton.classList.contains("saved") ? "Recipe saved" : "Removed from saves", "Your collection has been updated.");
    return;
  }

  const recipeCard = event.target.closest("[data-recipe-id]");
  if (recipeCard) {
    openRecipe(recipeCard.dataset.recipeId);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-id]");
  if (deleteButton) {
    const recipe = customRecipes.find(item => item.id === deleteButton.dataset.deleteId);
    if (recipe && confirm(`Delete “${recipe.title}”? This removes it from the public site.`)) {
      customRecipes = customRecipes.filter(item => item.id !== recipe.id);
      saveCustomRecipes();
      refreshRecipes();
      showToast("Recipe deleted", `${recipe.title} was removed.`);
    }
    return;
  }

  const updateCategoryButton = event.target.closest("[data-update-category]");
  if (updateCategoryButton) {
    updateCategory(Number(updateCategoryButton.dataset.updateCategory));
    return;
  }

  const removeCategoryButton = event.target.closest("[data-remove-category]");
  if (removeCategoryButton) {
    removeCategory(Number(removeCategoryButton.dataset.removeCategory));
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeRecipeModal();
    $(".search-panel").classList.remove("open");
    $(".mobile-nav").classList.remove("open");
  }
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-recipe-id]")) {
    event.preventDefault();
    openRecipe(event.target.dataset.recipeId);
  }
});

$(".search-toggle").addEventListener("click", () => {
  $(".search-panel").classList.add("open");
  $("#siteSearch").focus();
});
$(".search-close").addEventListener("click", () => $(".search-panel").classList.remove("open"));
$("#siteSearch").addEventListener("input", event => {
  searchTerm = event.target.value.trim();
  renderRecipeGrid();
  if (searchTerm) $("#recipes").scrollIntoView({ behavior: "smooth", block: "start" });
});

$(".mobile-menu-toggle").addEventListener("click", event => {
  const open = $(".mobile-nav").classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", String(open));
});

$("#filterRow").addEventListener("click", event => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  $$("#filterRow button").forEach(item => item.classList.toggle("active", item === button));
  renderRecipeGrid();
});

$("#categoryForm").addEventListener("submit", event => {
  event.preventDefault();
  addCategory($("#newCategoryName").value);
});

$("#loginForm").addEventListener("submit", event => {
  event.preventDefault();
  const email = $("#loginEmail").value.trim().toLowerCase();
  const password = $("#loginPassword").value;
  if (email === "admin@savorandstory.com" && password === "savor123") {
    sessionStorage.setItem(SESSION_KEY, "true");
    $("#loginError").textContent = "";
    showView("admin");
    openAdminPanel("overview");
    showToast("Welcome back, Amelia", "Your kitchen dashboard is ready.");
  } else {
    $("#loginError").textContent = "That email or password doesn’t match the demo access.";
    $("#loginPassword").focus();
  }
});

$("#fillDemo").addEventListener("click", () => {
  $("#loginEmail").value = "admin@savorandstory.com";
  $("#loginPassword").value = "savor123";
  $("#loginError").textContent = "";
});

$("#passwordToggle").addEventListener("click", event => {
  const input = $("#loginPassword");
  input.type = input.type === "password" ? "text" : "password";
  event.currentTarget.setAttribute("aria-label", input.type === "password" ? "Show password" : "Hide password");
});

$("#forgotPassword").addEventListener("click", () => showToast("Demo mode", "Use the demo access shown below the form."));
$("#logoutButton").addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  showView("home");
  showToast("Signed out", "You’ve safely left the kitchen dashboard.");
});

$(".admin-menu-toggle").addEventListener("click", () => $(".admin-sidebar").classList.toggle("open"));
$("#recipeForm").addEventListener("submit", publishRecipe);
$$('#recipeForm input, #recipeForm select, #recipeForm textarea').forEach(input => input.addEventListener("input", updatePreview));

$("#quickRecipeForm").addEventListener("submit", event => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  $("#recipeTitle").value = $("#quickTitle").value;
  $("#recipeCategory").value = $("#quickCategory").value;
  $("#recipeTime").value = $("#quickTime").value;
  updatePreview();
  openAdminPanel("editor");
});

$$('[data-close-modal]').forEach(element => element.addEventListener("click", closeRecipeModal));

const dateFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
$("#adminDate").textContent = dateFormat.format(new Date());

renderCategoryOptions();
renderFilterButtons();
renderRecipeGrid();
renderAdminContent();
renderCategoryManager();
updatePreview();

if (location.hash === "#login") showView("login", false);
else if (location.hash === "#admin" && sessionStorage.getItem(SESSION_KEY) === "true") showView("admin", false);
else showView("home", false);
