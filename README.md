# JSX + JSON Preview Manager

A local React application to preview, manage, version, and edit dynamically generated UI components (JSX) and their state (JSON).

## Installation & Setup

You can run this project either natively using Node.js or via Docker.

### Option 1: Native (Node.js)
Ensure you have Node.js (v18+) installed.

```bash
# Make scripts executable
chmod +x scripts/start.sh scripts/stop.sh

# Start the application
./scripts/start.sh
```
This will start:
- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173`

To stop the application:
```bash
./scripts/stop.sh
```

### Option 2: Docker Compose
```bash
docker-compose up -d
```

## How to use

1. Open your browser to `http://localhost:5173`.
2. Click **New Pair** in the sidebar.
3. Provide a name and upload your `component.jsx` and `data.json` files.
4. The component will render instantly. 
5. You can use the top tabs to switch between **Preview UI**, **JSX Editor**, and **JSON Data**.
6. When editing JSX or JSON, you can save your changes which will update the active version or create a new version.

## Component Contract

Your uploaded JSX component should accept the following props:
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
        className="bg-blue-600 text-white px-4 py-2 rounded"
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

## Versioning
When you upload a new pair, it is saved as `v1`. 
When you edit the JSX and click "Save as New Version", it will create `v2`, `v3`, etc.
You can switch between versions using the dropdown in the top bar.
