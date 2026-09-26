import React from "react";
import { describe, it, expect, vi } from "vitest";
import { DataTable, type ColumnDef } from "../DataTable";
import { TableActionChevron } from "../TableActionChevron";

type TestItem = {
  id: string;
  name: string;
  score: number;
  status: string;
};

const mockData: TestItem[] = [
  { id: "item-1", name: "Alice", score: 95, status: "active" },
  { id: "item-2", name: "Bob", score: 80, status: "pending" },
];

const mockColumns: ColumnDef<TestItem>[] = [
  {
    id: "name",
    header: "Name",
    sortKey: "name",
    cell: (item) => item.name,
  },
  {
    id: "score",
    header: "Score",
    sortKey: "score",
    align: "right",
    cell: (item) => String(item.score),
  },
  {
    id: "actions",
    header: "Actions",
    align: "right",
    cell: () => <TableActionChevron ariaLabel="View details" />,
  },
];

describe("DataTable", () => {
  it("renders headers and data rows correctly", () => {
    const el = DataTable({
      data: mockData,
      columns: mockColumns,
      ariaLabel: "Test Table",
    });

    expect(el).not.toBeNull();
    expect(el.props.role).toBeUndefined(); // tableWrap div
    const table = el.props.children;
    expect(table.type).toBe("table");
    expect(table.props["aria-label"]).toBe("Test Table");
  });

  it("handles sorting interaction and aria-sort", () => {
    const handleSort = vi.fn();
    const el = DataTable({
      data: mockData,
      columns: mockColumns,
      ariaLabel: "Sort Table",
      sortCol: "score",
      sortDesc: false,
      onSort: handleSort,
    });

    const table = el.props.children;
    const [thead, tbody] = table.props.children;
    const tr = thead.props.children;
    const ths = tr.props.children;

    // First column: sortKey="name", not active -> aria-sort="none"
    expect(ths[0].props["aria-sort"]).toBe("none");
    expect(ths[0].props["data-sortable"]).toBe("true");

    // Click sortable header
    ths[0].props.onClick();
    expect(handleSort).toHaveBeenCalledWith("name");

    // Second column: sortKey="score", active and asc -> aria-sort="ascending"
    expect(ths[1].props["aria-sort"]).toBe("ascending");

    // Third column: no sortKey -> aria-sort undefined, no onClick
    expect(ths[2].props["aria-sort"]).toBeUndefined();
    expect(ths[2].props["data-sortable"]).toBeUndefined();
  });

  it("handles row clicks and keyboard activation", () => {
    const handleRowClick = vi.fn();
    const el = DataTable({
      data: mockData,
      columns: mockColumns,
      ariaLabel: "Click Table",
      onRowClick: handleRowClick,
    });

    const table = el.props.children;
    const tbody = table.props.children[1];
    const rows = tbody.props.children;

    expect(rows).toHaveLength(2);
    const firstRow = rows[0];

    expect(firstRow.props.role).toBe("button");
    expect(firstRow.props.tabIndex).toBe(0);

    // Click
    firstRow.props.onClick();
    expect(handleRowClick).toHaveBeenCalledWith(mockData[0], 0);

    // Keydown Enter
    const preventDefault = vi.fn();
    firstRow.props.onKeyDown({ key: "Enter", preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(handleRowClick).toHaveBeenCalledWith(mockData[0], 0);
  });

  it("renders loading state with shimmer rows", () => {
    const el = DataTable({
      data: [],
      columns: mockColumns,
      ariaLabel: "Loading Table",
      isLoading: true,
      loadingRowCount: 3,
    });

    const table = el.props.children;
    const tbody = table.props.children[1];
    expect(tbody.props.children.props.rows).toBe(3);
    expect(tbody.props.children.props.columns).toBe(3);
  });

  it("renders error state with retry button", () => {
    const handleRetry = vi.fn();
    const el = DataTable({
      data: [],
      columns: mockColumns,
      ariaLabel: "Error Table",
      error: "Network failed",
      errorTitle: "Custom Error Title",
      onRetry: handleRetry,
    });

    const table = el.props.children;
    const tbody = table.props.children[1];
    const tr = tbody.props.children;
    const td = tr.props.children;
    expect(td.props.colSpan).toBe(3);

    const emptyBox = td.props.children;
    const [svg, h3, p, button] = emptyBox.props.children;
    expect(h3.props.children).toBe("Custom Error Title");
    expect(p.props.children).toBe("Network failed");

    button.props.onClick();
    expect(handleRetry).toHaveBeenCalled();
  });

  it("renders empty state object with action", () => {
    const el = DataTable({
      data: [],
      columns: mockColumns,
      ariaLabel: "Empty Table",
      emptyState: {
        title: "No users found",
        description: "Try adjusting filters",
        action: <button type="button">Reset</button>,
      },
    });

    const table = el.props.children;
    const tbody = table.props.children[1];
    const tr = tbody.props.children;
    const td = tr.props.children;
    expect(td.props.colSpan).toBe(3);

    const emptyBox = td.props.children;
    const [svg, h3, p, action] = emptyBox.props.children;
    expect(h3.props.children).toBe("No users found");
    expect(p.props.children).toBe("Try adjusting filters");
    expect(action.props.children).toBe("Reset");
  });

  it("supports custom renderRow override", () => {
    const el = DataTable({
      data: mockData,
      columns: mockColumns,
      ariaLabel: "Custom Row Table",
      renderRow: (item, idx) => (
        <tr key={item.id} data-testid={`custom-row-${idx}`}>
          <td colSpan={3}>{item.name}</td>
        </tr>
      ),
    });

    const table = el.props.children;
    const tbody = table.props.children[1];
    const rows = tbody.props.children;

    expect(rows[0].props["data-testid"]).toBe("custom-row-0");
    expect(rows[1].props["data-testid"]).toBe("custom-row-1");
  });

  it("uses column id as sortKey when sortable: true is specified without explicit sortKey", () => {
    const handleSort = vi.fn();
    const columnsWithSortable: ColumnDef<TestItem>[] = [
      {
        id: "status",
        header: "Status",
        sortable: true,
        cell: (item) => item.status,
      },
    ];

    const el = DataTable({
      data: mockData,
      columns: columnsWithSortable,
      ariaLabel: "Sortable Table",
      sortCol: "status",
      sortDesc: true,
      onSort: handleSort,
    });

    const table = el.props.children;
    const thead = table.props.children[0];
    const th = thead.props.children.props.children[0];

    expect(th.props["aria-sort"]).toBe("descending");
    expect(th.props["data-sortable"]).toBe("true");

    th.props.onClick();
    expect(handleSort).toHaveBeenCalledWith("status");
  });

  it("uses custom keyExtractor for row keys", () => {
    const keyExtractor = vi.fn((item: TestItem) => `custom-key-${item.id}`);
    const el = DataTable({
      data: mockData,
      columns: mockColumns,
      ariaLabel: "Key Extractor Table",
      keyExtractor,
    });

    const table = el.props.children;
    const tbody = table.props.children[1];
    const rows = tbody.props.children;

    expect(keyExtractor).toHaveBeenCalledWith(mockData[0], 0);
    expect(rows[0].key).toBe("custom-key-item-1");
    expect(rows[1].key).toBe("custom-key-item-2");
  });

  it("renders custom React element empty state", () => {
    const customEmptyElement = <div data-testid="custom-empty">Nothing here!</div>;
    const el = DataTable({
      data: [],
      columns: mockColumns,
      ariaLabel: "Custom Empty Table",
      emptyState: customEmptyElement,
    });

    const table = el.props.children;
    const tbody = table.props.children[1];
    const tr = tbody.props.children;
    const td = tr.props.children;

    expect(td.props.children).toBe(customEmptyElement);
  });

  it("renders default empty state when emptyState is not specified", () => {
    const el = DataTable({
      data: [],
      columns: mockColumns,
      ariaLabel: "Default Empty Table",
    });

    const table = el.props.children;
    const tbody = table.props.children[1];
    const tr = tbody.props.children;
    const td = tr.props.children;
    const emptyBox = td.props.children;

    expect(emptyBox.props.children[0].props.children).toBe("No items found");
    expect(emptyBox.props.children[1].props.children).toBe("There are no records to display.");
  });
});

describe("TableActionChevron", () => {
  it("renders action button and handles click", () => {
    const handleClick = vi.fn();
    const el = TableActionChevron({ ariaLabel: "View metric", onClick: handleClick });

    expect(el).not.toBeNull();
    const button = el.props.children;
    expect(button.props["aria-label"]).toBe("View metric");

    button.props.onClick();
    expect(handleClick).toHaveBeenCalled();
  });
});
