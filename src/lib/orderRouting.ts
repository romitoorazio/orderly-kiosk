export const DEFAULT_PRODUCTION_DEPT_ID = "cucina";

export type ProductionDestination = {
  id: string;
  name: string;
};

const normalizeId = (value: unknown) => String(value || "").trim();

export function normalizeProductionDeptIds(value: unknown, fallbackDeptId?: string): string[] {
  const fallback = normalizeId(fallbackDeptId) || DEFAULT_PRODUCTION_DEPT_ID;
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const ids = raw.map(normalizeId).filter(Boolean);
  return Array.from(new Set(ids.length ? ids : [fallback]));
}

export function getDepartmentName(departments: any[] | undefined, id: string): string {
  const found = (departments || []).find((dept: any) => String(dept.id) === String(id));
  return String(found?.name || id || "REPARTO").toUpperCase();
}

export function getDestinationLabels(ids: string[], departments: any[] | undefined): string[] {
  return normalizeProductionDeptIds(ids).map((id) => getDepartmentName(departments, id));
}

export function getDestinationsText(value: unknown, departments?: any[], fallbackDeptId?: string): string {
  const ids = normalizeProductionDeptIds(value, fallbackDeptId);
  return getDestinationLabels(ids, departments).join(" + ");
}

export function enrichCartItemRouting<T extends Record<string, any>>(item: T, departments?: any[]): T {
  const deptId = normalizeId(item.departmentId || item.department || item.categoryId);
  const productionDeptIds = normalizeProductionDeptIds(
    item.productionDeptIds || item.destinationDeptIds || item.kitchenDeptIds,
    deptId,
  );
  return {
    ...item,
    departmentId: deptId,
    department: deptId,
    productionDeptIds,
    destinationDeptIds: productionDeptIds,
    destinationLabels: getDestinationLabels(productionDeptIds, departments),
  };
}

export function getOrderSourceLabel(order: any): string {
  if (order?.sourceLabel) return String(order.sourceLabel).toUpperCase();
  if (order?.orderSource?.label) return String(order.orderSource.label).toUpperCase();
  if (order?.origine === "cameriere") {
    return `CAMERIERE${order?.tableNumber ? ` Â· TAVOLO ${order.tableNumber}` : ""}`;
  }
  if (order?.origine === "qr" || order?.isMobile) {
    return `MOBILE / QR${order?.tableNumber ? ` Â· TAVOLO ${order.tableNumber}` : ""}`;
  }
  if (order?.origine === "cassa") return "CASSA";
  return "TOTEM";
}

export function getOrderDestinationDeptIds(order: any): string[] {
  const ids = (order?.items || []).flatMap((item: any) =>
    normalizeProductionDeptIds(
      item?.productionDeptIds || item?.destinationDeptIds || item?.kitchenDeptIds,
      item?.departmentId || item?.department,
    ),
  );
  return Array.from(new Set(ids));
}

export function itemMatchesDestination(item: any, destinationId: string): boolean {
  if (!destinationId || destinationId === "ALL") return true;
  const ids = normalizeProductionDeptIds(
    item?.productionDeptIds || item?.destinationDeptIds || item?.kitchenDeptIds,
    item?.departmentId || item?.department,
  );
  return ids.includes(destinationId);
}
