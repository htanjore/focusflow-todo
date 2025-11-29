(function () {
  const STORAGE_KEY = "focusflow.todos.v1";

  const taskForm = document.getElementById("task-form");
  const titleInput = document.getElementById("task-title");
  const dueInput = document.getElementById("task-due");
  const prioritySelect = document.getElementById("task-priority");
  const searchInput = document.getElementById("search");
  const sortSelect = document.getElementById("sort");
  const filterButtons = Array.from(document.querySelectorAll(".segmented-control-item"));
  const taskListEl = document.getElementById("task-list");
  const summaryEl = document.getElementById("task-summary");
  const completeSelectedBtn = document.getElementById("complete-selected");
  const clearCompletedBtn = document.getElementById("clear-completed");

  let tasks = [];
  let filter = "all";
  let searchQuery = "";
  let selectedIds = new Set();
  let dragState = { id: null };

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        tasks = data.map((t) => ({
          id: String(t.id ?? crypto.randomUUID()),
          title: String(t.title ?? ""),
          completed: Boolean(t.completed),
          createdAt: t.createdAt || Date.now(),
          due: t.due || "",
          priority: ["low", "medium", "high"].includes(t.priority) ? t.priority : "medium",
        }));
      }
    } catch (e) {
      console.error("Failed to parse stored tasks", e);
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.error("Failed to save tasks", e);
    }
  }

  function createTask({ title, due, priority }) {
    const task = {
      id: crypto.randomUUID(),
      title: title.trim(),
      completed: false,
      createdAt: Date.now(),
      due: due || "",
      priority: priority || "medium",
    };
    tasks.unshift(task);
    saveToStorage();
    render();
    return task;
  }

  function updateTask(id, updates) {
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) return;
    tasks[idx] = { ...tasks[idx], ...updates };
    saveToStorage();
    render();
  }

  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    selectedIds.delete(id);
    saveToStorage();
    render();
  }

  function reorderTask(id, targetIndex) {
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1 || targetIndex < 0 || targetIndex >= tasks.length) return;
    const [task] = tasks.splice(idx, 1);
    tasks.splice(targetIndex, 0, task);
    saveToStorage();
    render();
  }

  function applyFilterAndSearch(list) {
    let result = list;
    if (filter === "active") {
      result = result.filter((t) => !t.completed);
    } else if (filter === "completed") {
      result = result.filter((t) => t.completed);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }
    return result;
  }

  function applySort(list) {
    const arr = [...list];
    const [key, dir] = sortSelect.value.split("-");

    arr.sort((a, b) => {
      if (key === "created") {
        return dir === "asc" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
      }
      if (key === "due") {
        const ad = a.due ? new Date(a.due).getTime() : Infinity;
        const bd = b.due ? new Date(b.due).getTime() : Infinity;
        return dir === "asc" ? ad - bd : bd - ad;
      }
      if (key === "priority") {
        const rank = { high: 3, medium: 2, low: 1 };
        return dir === "asc"
          ? rank[a.priority] - rank[b.priority]
          : rank[b.priority] - rank[a.priority];
      }
      return 0;
    });

    return arr;
  }

  function formatDue(dueStr) {
    if (!dueStr) return null;
    const date = new Date(dueStr + "T00:00:00");
    if (Number.isNaN(date.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.round((date - today) / (1000 * 60 * 60 * 24));

    let label = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    let status = "future";

    if (diffDays === 0) {
      label = "Today";
      status = "today";
    } else if (diffDays === -1) {
      label = "Yesterday";
      status = "overdue";
    } else if (diffDays < -1) {
      label += ` · ${Math.abs(diffDays)}d overdue`;
      status = "overdue";
    } else if (diffDays === 1) {
      label += " · tomorrow";
    } else if (diffDays <= 7) {
      label += ` · in ${diffDays}d`;
    }

    return { label, status };
  }

  function updateSummary(list) {
    const total = tasks.length;
    const active = tasks.filter((t) => !t.completed).length;
    const completed = total - active;
    const visible = list.length;
    summaryEl.textContent = `${visible} shown · ${active} active · ${completed} completed`;
  }

  function updateBulkButtons() {
    const hasSelection = selectedIds.size > 0;
    const hasCompleted = tasks.some((t) => t.completed);
    completeSelectedBtn.disabled = !hasSelection;
    clearCompletedBtn.disabled = !hasCompleted;
  }

  function render() {
    const filtered = applyFilterAndSearch(tasks);
    const sorted = applySort(filtered);
    updateSummary(sorted);
    updateBulkButtons();

    const activeIds = new Set(sorted.map((t) => t.id));
    selectedIds.forEach((id) => {
      if (!activeIds.has(id)) selectedIds.delete(id);
    });

    taskListEl.innerHTML = "";

    if (!sorted.length) {
      const empty = document.createElement("p");
      empty.textContent = "No tasks yet. Add your first one above.";
      empty.className = "hint-text";
      taskListEl.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();

    sorted.forEach((task, index) => {
      const item = document.createElement("li");
      item.className = "task-item" + (task.completed ? " completed" : "");
      item.dataset.id = task.id;
      item.draggable = true;
      item.setAttribute("role", "listitem");
      item.setAttribute("aria-selected", selectedIds.has(task.id) ? "true" : "false");

      const check = document.createElement("button");
      check.type = "button";
      check.className = "task-check";
      check.setAttribute("aria-label", task.completed ? "Mark as active" : "Mark as completed");
      check.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M13.6 3.6a1 1 0 0 1 .1 1.3l-.1.12-6.3 6.3a1 1 0 0 1-1.3.1l-.1-.1-3-3a1 1 0 0 1 1.3-1.5l.1.1 2.3 2.29 5.6-5.58a1 1 0 0 1 1.4 0Z"/></svg>';
      check.addEventListener("click", () => {
        updateTask(task.id, { completed: !task.completed });
      });

      const main = document.createElement("div");
      main.className = "task-main";

      const title = document.createElement("p");
      title.className = "task-title";
      title.textContent = task.title;
      title.title = task.title;
      title.addEventListener("dblclick", () => beginInlineEdit(task, item));
      main.appendChild(title);

      const metaRow = document.createElement("div");
      metaRow.className = "task-meta-row";

      const priorityBadge = document.createElement("span");
      priorityBadge.className = `badge badge-priority-${task.priority}`;
      priorityBadge.textContent =
        task.priority === "high" ? "High" : task.priority === "low" ? "Low" : "Medium";
      metaRow.appendChild(priorityBadge);

      const dueInfo = formatDue(task.due);
      if (dueInfo) {
        const dueBadge = document.createElement("span");
        dueBadge.className = "badge";
        if (dueInfo.status === "today") {
          dueBadge.classList.add("badge-due-today");
        } else if (dueInfo.status === "overdue") {
          dueBadge.classList.add("badge-overdue");
        }
        dueBadge.textContent = `Due ${dueInfo.label}`;
        metaRow.appendChild(dueBadge);
      }

      const created = document.createElement("span");
      created.textContent = new Date(task.createdAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
      metaRow.appendChild(created);

      main.appendChild(metaRow);

      const actions = document.createElement("div");
      actions.className = "task-actions";

      const dragHandle = document.createElement("button");
      dragHandle.type = "button";
      dragHandle.className = "icon-button drag-handle";
      dragHandle.setAttribute("aria-label", "Drag to reorder");
      dragHandle.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm8 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM5 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm8 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-8 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm8 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>';
      actions.appendChild(dragHandle);

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "icon-button";
      editBtn.setAttribute("aria-label", "Edit task");
      editBtn.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M12.7 1.3a1 1 0 0 1 1.4 0l.6.6a2 2 0 0 1 0 2.8l-1.1 1.1-3.4-3.4 1.1-1.1a2 2 0 0 1 1.4-.6Zm-3 2.9 3.4 3.4-6.7 6.7a2 2 0 0 1-.9.5l-2.7.6a.5.5 0 0 1-.6-.6l.6-2.7a2 2 0 0 1 .5-.9l6.4-6.3Z"/></svg>';
      editBtn.addEventListener("click", () => beginInlineEdit(task, item));
      actions.appendChild(editBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "icon-button danger";
      deleteBtn.setAttribute("aria-label", "Delete task");
      deleteBtn.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M6 1a1 1 0 0 0-.96.73L4.7 3H2.5a.75.75 0 0 0 0 1.5h.31l.44 7.03A2.25 2.25 0 0 0 5.5 13.75h5a2.25 2.25 0 0 0 2.25-2.22l.44-7.03h.31a.75.75 0 0 0 0-1.5H11.3l-.34-1.27A1 1 0 0 0 10 1H6Zm1.03 4.25a.75.75 0 0 1 .72.78l-.16 4.5a.75.75 0 0 1-1.5-.06l.16-4.5a.75.75 0 0 1 .78-.72Zm3.16 0a.75.75 0 0 1 .72.78l-.16 4.5a.75.75 0 1 1-1.5-.06l.16-4.5a.75.75 0 0 1 .78-.72Z"/></svg>';
      deleteBtn.addEventListener("click", () => {
        if (confirm("Delete this task?")) {
          deleteTask(task.id);
        }
      });
      actions.appendChild(deleteBtn);

      item.appendChild(check);
      item.appendChild(main);
      item.appendChild(actions);

      item.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        toggleSelection(task.id);
      });

      item.addEventListener("keydown", (event) => {
        if (event.key === " " && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          toggleSelection(task.id);
        } else if ((event.altKey || event.metaKey) && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
          event.preventDefault();
          const delta = event.key === "ArrowUp" ? -1 : 1;
          reorderTaskByDelta(task.id, delta);
        }
      });

      setupDrag(item, dragHandle, index);

      fragment.appendChild(item);
    });

    taskListEl.appendChild(fragment);
  }

  function beginInlineEdit(task, itemEl) {
    const main = itemEl.querySelector(".task-main");
    const titleEl = main.querySelector(".task-title");
    const currentText = titleEl.textContent || "";

    const input = document.createElement("input");
    input.type = "text";
    input.value = currentText;
    input.className = "inline-edit";
    input.style.width = "100%";

    main.replaceChild(input, titleEl);
    input.focus();
    input.select();

    const finalize = (commit) => {
      if (commit) {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== task.title) {
          updateTask(task.id, { title: newTitle });
          return;
        }
      }
      render();
    };

    input.addEventListener("blur", () => finalize(true));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        finalize(true);
      } else if (event.key === "Escape") {
        finalize(false);
      }
    });
  }

  function toggleSelection(id) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    render();
  }

  function reorderTaskByDelta(id, delta) {
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) return;
    const targetIndex = index + delta;
    reorderTask(id, targetIndex);
  }

  function setupDrag(itemEl, handleEl, index) {
    handleEl.addEventListener("mousedown", () => {
      dragState.id = itemEl.dataset.id || null;
    });

    itemEl.addEventListener("dragstart", (event) => {
      if (dragState.id !== itemEl.dataset.id) {
        event.preventDefault();
        return;
      }
      itemEl.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", itemEl.dataset.id || "");
    });

    itemEl.addEventListener("dragend", () => {
      itemEl.classList.remove("dragging");
      dragState.id = null;
    });

    itemEl.addEventListener("dragover", (event) => {
      event.preventDefault();
      const draggingId = dragState.id;
      if (!draggingId || draggingId === itemEl.dataset.id) return;
      const draggingIndex = tasks.findIndex((t) => t.id === draggingId);
      const thisIndex = tasks.findIndex((t) => t.id === itemEl.dataset.id);
      if (draggingIndex === -1 || thisIndex === -1) return;

      const rect = itemEl.getBoundingClientRect();
      const isAfter = event.clientY > rect.top + rect.height / 2;
      const targetIndex = thisIndex + (isAfter ? 1 : 0);
      if (targetIndex !== draggingIndex) {
        reorderTask(draggingId, targetIndex);
      }
    });
  }

  taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!titleInput.value.trim()) {
      titleInput.focus();
      return;
    }
    createTask({
      title: titleInput.value,
      due: dueInput.value,
      priority: prioritySelect.value,
    });
    taskForm.reset();
    prioritySelect.value = "medium";
    titleInput.focus();
  });

  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    render();
  });

  sortSelect.addEventListener("change", () => {
    render();
  });

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-checked", b === btn ? "true" : "false");
      });
      filter = btn.dataset.filter || "all";
      render();
    });
  });

  completeSelectedBtn.addEventListener("click", () => {
    if (!selectedIds.size) return;
    tasks = tasks.map((t) =>
      selectedIds.has(t.id)
        ? {
            ...t,
            completed: true,
          }
        : t
    );
    selectedIds.clear();
    saveToStorage();
    render();
  });

  clearCompletedBtn.addEventListener("click", () => {
    if (!tasks.some((t) => t.completed)) return;
    if (!confirm("Clear all completed tasks?")) return;
    tasks = tasks.filter((t) => !t.completed);
    saveToStorage();
    render();
  });

  document.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      titleInput.focus();
    } else if (event.key === "/") {
      event.preventDefault();
      searchInput.focus();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
      searchInput.focus();
    } else if (event.key.toLowerCase() === "a") {
      setFilter("all");
    } else if (event.key.toLowerCase() === "c") {
      setFilter("completed");
    } else if (event.key.toLowerCase() === "x") {
      setFilter("active");
    } else if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      const firstVisible = applySort(applyFilterAndSearch(tasks))[0];
      if (firstVisible) {
        updateTask(firstVisible.id, { completed: !firstVisible.completed });
      }
    }
  });

  function setFilter(value) {
    const btn = filterButtons.find((b) => b.dataset.filter === value);
    if (!btn) return;
    btn.click();
  }

  loadFromStorage();
  render();
})();
