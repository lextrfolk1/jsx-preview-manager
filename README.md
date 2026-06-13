# JSX + JSON Preview Manager

A modern, local React application to preview, manage, version, and edit dynamically generated UI components (JSX) and their state (JSON).

## Installation & Setup

Ensure you have Node.js (v18+) installed.

```bash
# Make scripts executable (macOS/Linux)
chmod +x scripts/start.sh scripts/stop.sh

# Start the application
./scripts/start.sh
```

This will automatically launch:
- **Backend API**: `http://localhost:3001`
- **Frontend UI**: `http://localhost:5173`

To gracefully shut down the servers, simply run:
```bash
./scripts/stop.sh
```

---

## Features & Supported Operations

### 1. Creating Pairs
You can create a new component/data pair by clicking **New Pair** in the sidebar. You have two options for uploading:
- **Individual Files:** Upload your raw `component.jsx` and `data.json` files directly.
- **ZIP Archive:** Upload a `.zip` file containing your JSX and JSON files. The backend will automatically extract and parse them!

### 2. Live Preview
- The **Preview UI** tab instantly transpiles your uploaded JSX code in the browser using Babel.
- The UI runs in an isolated `iframe` sandbox for security, polyfilled with React and Tailwind CSS.
- **Fullscreen Mode:** Click the Fullscreen button in the preview header to test your component across the entire screen.

### 3. Editing Code (Safe Mode)
- Switch to the **JSX Editor** or **JSON Data** tabs to view the underlying code.
- By default, the editors are **locked (read-only)** to prevent accidental keystrokes.
- To make changes, click the floating **Edit JSX / Edit JSON** toggle located in the tab bar.
- If your JSON contains invalid syntax, an error panel will instantly warn you.

### 4. Version Control
- **Save:** Overwrites the *current* active version with your edits.
- **Save as New Version:** Creates a brand new version (e.g., `v2`, `v3`) while preserving your old history.
- Use the **Version Dropdown** in the top navigation bar to time-travel between different historical versions of your UI.

### 5. Downloading
- Click **Download** in the top-right corner to package the currently active version.
- The server will dynamically generate a clean `.zip` file containing your `component.jsx` and `data.json` nicely tucked inside a named folder.

### 6. Deleting
- Hover over any pair in the sidebar to reveal the trash icon to completely delete a pair.

---

## Component Contract

To properly interface with the preview environment, your uploaded JSX component must use a default export and should accept the following props:

- `data`: The JSON object representing the state.
- `onChange(path, value)`: A callback to notify the manager when data changes.
- `onAction(actionName, payload)`: A callback for arbitrary user actions (e.g. submit).

### Example JSX (`component.jsx`)
```jsx
export default function DynamicComponent({ data, onChange, onAction }) {
  return (
    <div className="p-4 border rounded shadow-sm bg-white">
      <h2 className="text-xl font-bold mb-4">{data.title}</h2>

      <select
        className="border p-2 rounded mb-4"
        value={data.selectedOption}
        onChange={(e) => onChange("selectedOption", e.target.value)}
      >
        {data.options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <button 
        className="bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:shadow"
        onClick={() => onAction("submit", data)}
      >
        Submit
      </button>
    </div>
  );
}
```

### Example JSON (`data.json`)
```json
{
  "title": "My Dashboard",
  "selectedOption": "opt2",
  "options": [
    { "label": "Option 1", "value": "opt1" },
    { "label": "Option 2", "value": "opt2" }
  ]
}
```
