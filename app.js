// SortMedication: a simple medication inventory that lives in your browser.
//
// Each medication is stored as an object like this:
//   {
//     id: "1729450000000",   // a unique number so we can find it again
//     name: "Paracetamol",
//     dose: "500 mg",
//     quantity: 20,
//     expiry: "2026-12-31",  // stored as YYYY-MM-DD text, or "" if unknown
//     restock: 5             // warn when quantity is at or below this
//   }
//
// The whole list is saved in the browser's localStorage, so it is still
// there when you close and reopen the page (on the same browser).

// Settings you can change
const STORAGE_KEY = "sortmedication.medications";
const SOON_DAYS = 30; // how many days ahead counts as "expiring soon"

// Grab the parts of the page we need to work with
const form = document.getElementById("add-form");
const list = document.getElementById("med-list");
const sortBy = document.getElementById("sort-by");
const emptyMessage = document.getElementById("empty-message");

// The list of medications currently in memory
let medications = loadMedications();

// ---------- Saving and loading ----------

function loadMedications() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return [];
  }
  try {
    return JSON.parse(saved);
  } catch (error) {
    // If the saved data is broken, start fresh rather than crash
    return [];
  }
}

function saveMedications() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(medications));
}

// ---------- Working out warnings ----------

// How many days from today until the given date ("YYYY-MM-DD").
// Returns null if there is no date.
function daysUntil(dateText) {
  if (!dateText) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateText + "T00:00:00");
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((date - today) / msPerDay);
}

// Returns a list of warning names for a medication, e.g. ["low", "soon"]
function getWarnings(med) {
  const warnings = [];
  if (med.quantity <= med.restock) {
    warnings.push("low");
  }
  const days = daysUntil(med.expiry);
  if (days !== null && days < 0) {
    warnings.push("expired");
  } else if (days !== null && days <= SOON_DAYS) {
    warnings.push("soon");
  }
  return warnings;
}

const WARNING_LABELS = {
  low: "Low stock",
  soon: "Expires soon",
  expired: "Expired",
};

// ---------- Sorting ----------

function sortedMedications() {
  // Make a copy so we don't change the saved order
  const copy = medications.slice();
  if (sortBy.value === "expiry") {
    copy.sort(function (a, b) {
      // Items with no expiry date go to the bottom
      if (!a.expiry) return 1;
      if (!b.expiry) return -1;
      return a.expiry.localeCompare(b.expiry);
    });
  } else {
    copy.sort(function (a, b) {
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }
  return copy;
}

// ---------- Showing the list ----------

// Create a table cell containing plain text
function textCell(text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  return cell;
}

function render() {
  list.innerHTML = "";
  emptyMessage.hidden = medications.length > 0;

  sortedMedications().forEach(function (med) {
    const row = document.createElement("tr");
    const warnings = getWarnings(med);

    // Colour the row by its most serious warning
    if (warnings.includes("expired")) {
      row.className = "expired";
    } else if (warnings.includes("soon")) {
      row.className = "soon";
    } else if (warnings.includes("low")) {
      row.className = "low";
    }

    row.appendChild(textCell(med.name));
    row.appendChild(textCell(med.dose));

    // Quantity with - and + buttons
    const qtyCell = document.createElement("td");
    qtyCell.className = "qty";
    const minus = document.createElement("button");
    minus.textContent = "−";
    minus.className = "small";
    minus.title = "Use one";
    minus.addEventListener("click", function () {
      changeQuantity(med.id, -1);
    });
    const amount = document.createElement("span");
    amount.textContent = med.quantity;
    const plus = document.createElement("button");
    plus.textContent = "+";
    plus.className = "small";
    plus.title = "Add one";
    plus.addEventListener("click", function () {
      changeQuantity(med.id, 1);
    });
    qtyCell.append(minus, amount, plus);
    row.appendChild(qtyCell);

    row.appendChild(textCell(med.expiry || "—"));
    row.appendChild(textCell(med.restock));

    // Status badges
    const statusCell = document.createElement("td");
    warnings.forEach(function (warning) {
      const badge = document.createElement("span");
      badge.className = "badge " + warning;
      badge.textContent = WARNING_LABELS[warning];
      statusCell.appendChild(badge);
    });
    if (warnings.length === 0) {
      statusCell.textContent = "OK";
    }
    row.appendChild(statusCell);

    // Delete button
    const actionCell = document.createElement("td");
    const remove = document.createElement("button");
    remove.textContent = "Delete";
    remove.className = "small delete";
    remove.addEventListener("click", function () {
      deleteMedication(med.id);
    });
    actionCell.appendChild(remove);
    row.appendChild(actionCell);

    list.appendChild(row);
  });
}

// ---------- Changing the list ----------

function changeQuantity(id, amount) {
  const med = medications.find(function (m) {
    return m.id === id;
  });
  med.quantity = Math.max(0, med.quantity + amount);
  saveMedications();
  render();
}

function deleteMedication(id) {
  const med = medications.find(function (m) {
    return m.id === id;
  });
  if (!confirm("Delete " + med.name + "?")) {
    return;
  }
  medications = medications.filter(function (m) {
    return m.id !== id;
  });
  saveMedications();
  render();
}

form.addEventListener("submit", function (event) {
  // Stop the browser from reloading the page
  event.preventDefault();

  medications.push({
    id: String(Date.now()),
    name: document.getElementById("name").value.trim(),
    dose: document.getElementById("dose").value.trim(),
    quantity: Number(document.getElementById("quantity").value) || 0,
    expiry: document.getElementById("expiry").value,
    restock: Number(document.getElementById("restock").value) || 0,
  });
  saveMedications();
  render();

  form.reset();
  document.getElementById("name").focus();
});

sortBy.addEventListener("change", render);

// Draw the list when the page first loads
render();
