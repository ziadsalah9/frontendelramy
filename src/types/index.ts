export type UserRole = 'ADMIN' | 'EMPLOYEE';

// Must match the backend enum Elramy...enums.PaymentMethod exactly.
export type PaymentMethod = 'CASH' | 'VISA' | 'INSTAPAY' | 'VODAFONE_CASH' | 'MIXED';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'نقدي' },
  { value: 'VISA', label: 'فيزا / بطاقة' },
  { value: 'INSTAPAY', label: 'إنستاباي' },
  { value: 'VODAFONE_CASH', label: 'فودافون كاش' },
  { value: 'MIXED', label: 'مختلط' },
];

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  branchId?: number | null;
  branchName?: string | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  userId: number;
  username: string;
  fullName: string;
  role: UserRole;
  branchId: number | null;
  branchName: string | null;
}
export interface Branch {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  active?: boolean;
}

/** Name of a product type; types are managed by admins (product_types, see useProductTypes). */
export type ProductType = string;

export interface ItemType {
  id: number;
  name: string;
  active: boolean;
  /** How many products / incomplete products use it (admin list only). */
  products: number;
  drafts: number;
}

export const PRODUCT_COLORS: { value: string; label: string }[] = [
  { value: 'أبيض', label: 'أبيض' },
  { value: 'بيج', label: 'بيج' },
  { value: 'رمادي', label: 'رمادي' },
  { value: 'أسود', label: 'أسود' },
  { value: 'كحلي', label: 'كحلي' },
  { value: 'أحمر', label: 'أحمر' },
  { value: 'أخضر', label: 'أخضر' },
  { value: 'زيتي', label: 'زيتي' },
  { value: 'بني', label: 'بني' },
  { value: 'وردي', label: 'وردي' },
  { value: 'أصفر', label: 'أصفر' },
  { value: 'برتقالي', label: 'برتقالي' },
  { value: 'بنفسجي', label: 'بنفسجي' },
  { value: 'فيروزي', label: 'فيروزي' },
  { value: 'ذهبي', label: 'ذهبي' },
  { value: 'فضي', label: 'فضي' },
  { value: 'متعدد', label: 'متعدد الألوان' },
];

/**
 * One colour/size of a product, with its own stock, code and barcode.
 * Colour and size are each optional.
 */
export interface ProductVariant {
  id: number;
  code: string;
  barcode?: string | null;
  color?: string | null;
  size?: string | null;
  /** "أحمر / كبير", "أحمر", "كبير" or "بدون لون أو مقاس". */
  label: string;
  quantity: number;
  active?: boolean;
}

export interface Product {
  id: number;
  code?: string;
  name: string;
  itemType: ProductType;
  model?: string;
  minimumQuantity: number;
  active?: boolean;
  /** One price for every colour/size. */
  currentPrice?: ProductPrice | null;
  /** Total stock across all colours/sizes. */
  quantity: number;
  /** Total quantity <= minimumQuantity */
  lowStock?: boolean;
  variants: ProductVariant[];
}

/** A colour/size in a product create/update; id set for an existing one. */
export interface ProductVariantInput {
  id?: number;
  color?: string | null;
  size?: string | null;
  /** Wanted stock; null = unchanged. New: opening stock. Existing: adjustment. */
  quantity?: number | null;
  /** Stock the form started from; the server rejects the edit if it changed since. */
  expectedQuantity?: number | null;
}

export interface ProductCreateInput {
  name: string;
  itemType: ProductType;
  model?: string;
  minimumQuantity: number;
  /** The full list of colours/sizes; ones left out are removed. */
  variants: ProductVariantInput[];
  /** Total available quantity; the remainder becomes "بدون لون أو مقاس". Omit to leave stock as is. */
  totalQuantity?: number;
}

export interface VariantLookup {
  product: Product;
  variant: ProductVariant;
}

/** One problem in an uploaded product sheet (row = Excel row, header = 1). */
export interface ProductImportRowError {
  row: number;
  column: string | null;
  message: string;
}

/**
 * An incomplete product from an Excel import ("منتجات غير مكتملة").
 * It stays out of the system (sales, stock, lists) until completed.
 */
/** A colour/size row of an incomplete product; quantity null = not entered. */
export interface ProductDraftVariant {
  id?: number | null;
  color: string | null;
  size: string | null;
  quantity: number | null;
  sourceRow?: number | null;
}

export interface ProductDraft {
  id: number;
  name: string | null;
  itemType: ProductType | null;
  model: string | null;
  minimumQuantity: number | null;
  /** Total available quantity; required to complete the draft. */
  totalQuantity: number | null;
  purchasePrice: number | null;
  profitPercentage: number | null;
  sellingPrice: number | null;
  /** Colours/sizes, each with its quantity. */
  variants: ProductDraftVariant[];
  /** Required fields still empty (Arabic labels). Empty = can be completed. */
  missingFields: string[];
  /** What the import cleared and why. */
  notes: string[];
  sourceFile: string | null;
  sourceRow: number | null;
  createdAt: string;
}

export type ProductDraftInput = Partial<Omit<ProductDraft, 'id' | 'missingFields' | 'notes' | 'sourceFile' | 'sourceRow' | 'createdAt'>>;

export interface ProductImportSkippedRow {
  row: number;
  name: string | null;
  reason: string;
}

export interface ProductImportResult {
  created: number;
  withPrice: number;
  /** Products created with an opening quantity > 0. */
  withStock: number;
  /** Sum of the opening quantities. */
  totalQuantity: number;
  products: Product[];
  /** New colours/sizes added to products that already existed. */
  variantsAdded: number;
  /** Incomplete rows saved to "منتجات غير مكتملة". */
  drafted: number;
  drafts: ProductDraft[];
  /** Duplicates that were not imported. */
  skipped: ProductImportSkippedRow[];
  /** File-level notes, e.g. a missing column. */
  warnings: string[];
}

export interface ProductPrice {
  id: number;
  productId?: number;
  purchasePrice: number;
  sellingPrice: number;
  profitPercentage?: number;
  active?: boolean;
  createdAt?: string;
}

export interface ProductPriceUpdateInput {
  purchasePrice: number;
  profitPercentage?: number;
  sellingPrice?: number;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  secondaryPhone?: string | null;
  address?: string;
  active: boolean;
}

export interface CustomerCreateInput {
  name: string;
  phone: string;
  secondaryPhone?: string;
  address?: string;
}

export interface CustomerDeleteResult {
  id: number;
  /** false = the customer has invoices, so it was deactivated instead. */
  permanentlyDeleted: boolean;
}

export interface InvoiceItem {
  id: number;
  productId: number;
  quantity: number;
  unitPrice?: number;
  discount: number;
  productName?: string;
  total?: number;
  /** The colour/size sold or bought (null on very old lines). */
  variantId?: number | null;
  variantCode?: string | null;
  color?: string | null;
  size?: string | null;
  /** Pieces already returned (sales only). */
  returnedQuantity?: number;
}

export interface PurchaseInvoice {
  id: number;
  invoiceNumber: string;
  branchId: number;
  items: InvoiceItem[];
  discount: number;
  paid: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  total?: number;
  remaining?: number;
  createdAt: string;
  branchName?: string;
  /** Null on purchases made before suppliers existed. */
  supplierId?: number | null;
  supplierName?: string | null;
}

export interface PurchaseInvoiceCreateInput {
  invoiceNumber: string;
  supplierId: number;
  branchId: number;
  items: { variantId: number; quantity: number; unitPrice: number; discount: number }[];
  discount: number;
  paid: number;
  paymentMethod: PaymentMethod;
  notes?: string;
}

// The backend nests the customer object, it does not flatten it.
export interface SalesInvoice {
  id: number;
  invoiceNumber: string;
  branchId: number;
  customer?: Customer | null;
  cashierId?: number;
  cashierName?: string;
  items: InvoiceItem[];
  discount: number;
  paid: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  total?: number;
  remaining?: number;
  createdAt: string;
  branchName?: string;
  /** Cash part of `paid` (null = unknown, old MIXED invoices). */
  cashAmount?: number | null;
  /** Value already returned. */
  returnedTotal?: number;
}

export interface SalesInvoiceCreateInput {
  branchId: number;
  customer: { name: string; phone: string; address?: string };
  paymentMethod: PaymentMethod;
  items: { variantId: number; quantity: number; discount: number }[];
  discount: number;
  paid: number;
  notes?: string;
  /** Cash part of `paid`; required for MIXED. */
  cashAmount?: number;
  /** Sell on installments (ADMIN): what is not paid now becomes a monthly plan. */
  installment?: { months: number; markupPercent: number; firstDueDate?: string };
}

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  branchId?: number;
  active: boolean;
  branchName?: string;
}

export interface UserCreateInput {
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
  branchId?: number;
}

export interface UserUpdateInput {
  username: string;
  password?: string;
  fullName: string;
  role: UserRole;
  branchId?: number;
  active: boolean;
}

export interface ApiError {
  message: string;
  status: number;
  fieldErrors?: Record<string, string>;
}
// ---------------------------------------------------------------- activity log (ADMIN-only)

export type ActivityAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS' | 'PRICE' | 'STOCK' | 'IMPORT' | 'COMPLETE';
export type ActivityEntity =
  | 'PRODUCT'
  | 'SALES_INVOICE'
  | 'PURCHASE_INVOICE'
  | 'CUSTOMER'
  | 'USER'
  | 'BRANCH'
  | 'CASH_CLOSING'
  | 'PRODUCT_DRAFT'
  | 'STOCKTAKE'
  | 'SALES_RETURN'
  | 'CUSTOMER_PAYMENT'
  | 'SETTINGS'
  | 'SUPPLIER'
  | 'EXPENSE'
  | 'INSTALLMENT';

/** One changed field; `before` is null for new values, `after` for removed ones. */
export interface ActivityChange {
  field: string;
  before: string | null;
  after: string | null;
}

export interface ActivityLogEntry {
  id: number;
  createdAt: string;
  userId?: number | null;
  username?: string | null;
  userFullName?: string | null;
  action: ActivityAction;
  entityType: ActivityEntity;
  entityId?: number | null;
  entityLabel?: string | null;
  description: string;
  changes: ActivityChange[];
}

export interface ActivityLogPage {
  content: ActivityLogEntry[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ActivityLogFilters {
  userId?: number;
  entityType?: ActivityEntity;
  action?: ActivityAction;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  size?: number;
}

// ---------------------------------------------------------------- stocktaking (ADMIN-only)

export type StocktakeStatus = 'OPEN' | 'APPROVED' | 'CANCELLED';
export type StocktakeReason = 'DAMAGED' | 'LOST' | 'COUNT_ERROR' | 'UNRECORDED' | 'OTHER';

export const STOCKTAKE_REASONS: { value: StocktakeReason; label: string }[] = [
  { value: 'DAMAGED', label: 'تالف' },
  { value: 'LOST', label: 'مفقود' },
  { value: 'COUNT_ERROR', label: 'خطأ عد سابق' },
  { value: 'UNRECORDED', label: 'زيادة غير مسجلة' },
  { value: 'OTHER', label: 'أخرى' },
];

export interface StocktakeSummary {
  id: number;
  code: string;
  title: string;
  /** Empty = the whole store. */
  types: ProductType[];
  status: StocktakeStatus;
  notes?: string | null;
  createdAt: string;
  createdByName?: string | null;
  approvedAt?: string | null;
  approvedByName?: string | null;
  countedLines: number;
  totalInScope: number;
  shortageCost?: number | null;
  surplusCost?: number | null;
  shortageSell?: number | null;
  surplusSell?: number | null;
}

/** What the counter sees: no system quantity (blind count). */
export interface StocktakeCountLine {
  variantId: number;
  productId: number;
  productName: string;
  itemType: ProductType | null;
  variantCode: string;
  barcode?: string | null;
  color?: string | null;
  size?: string | null;
  label: string;
  countedQty: number;
  countedAt?: string | null;
}

export interface StocktakeCountView {
  stocktake: StocktakeSummary;
  lines: StocktakeCountLine[];
}

export interface StocktakeReviewLine {
  variantId: number;
  productId: number;
  productName: string;
  itemType: ProductType | null;
  variantCode: string;
  label: string;
  /** Stock when the line was (last) counted. */
  systemQty: number;
  countedQty: number;
  variance: number;
  unitCost?: number | null;
  unitPrice?: number | null;
  costValue?: number | null;
  sellValue?: number | null;
  reason?: StocktakeReason | null;
  note?: string | null;
  /** Set on approval; differs from variance only when clamped at 0. */
  appliedVariance?: number | null;
  clamped: boolean;
}

export interface StocktakeReview {
  stocktake: StocktakeSummary;
  lines: StocktakeReviewLine[];
  uncounted: { variantId: number; productName: string; variantCode: string; label: string }[];
  linesWithDifference: number;
  shortageCost: number;
  surplusCost: number;
  shortageSell: number;
  surplusSell: number;
}

export interface StocktakeImportResult {
  filled: number;
  unknown: string[];
  outOfScope: string[];
  invalid: string[];
}

// ---------------------------------------------------------------- store settings

export interface StoreSettings {
  storeName: string;
  phone?: string | null;
  address?: string | null;
  receiptFooter?: string | null;
  /** Largest discount an employee may give, % of the invoice before discounts. */
  employeeMaxDiscountPercent: number;
}

// ---------------------------------------------------------------- customer account & returns

export interface CustomerPayment {
  id: number;
  paymentNumber: string;
  customerId: number;
  customerName: string;
  customerPhone?: string | null;
  branchId?: number | null;
  branchName?: string | null;
  amount: number;
  paymentMethod: PaymentMethod;
  notes?: string | null;
  receivedByName?: string | null;
  createdAt: string;
  balanceAfter?: number | null;
}

export interface CustomerStatementEntry {
  type: 'INVOICE' | 'PAYMENT' | 'RETURN' | 'INSTALLMENT_MARKUP';
  id: number;
  number: string;
  date: string;
  description: string;
  /** Added to (positive) or taken off (negative) the balance. */
  amount: number;
  balanceAfter: number;
}

export interface CustomerAccount {
  customerId: number;
  customerName: string;
  customerPhone: string;
  /** What the customer owes now. */
  balance: number;
  invoicedTotal: number;
  paidAtSale: number;
  laterPayments: number;
  returnCredits: number;
  entries: CustomerStatementEntry[];
}

export type RefundMethod = 'CASH' | 'CREDIT';

export interface SalesReturn {
  id: number;
  returnNumber: string;
  invoiceId: number;
  invoiceNumber: string;
  customerId?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  branchId?: number | null;
  total: number;
  cashRefund: number;
  creditAmount: number;
  reason?: string | null;
  createdByName?: string | null;
  createdAt: string;
  items: { invoiceItemId: number; productId: number; productName: string; variantLabel?: string | null; quantity: number; unitRefund: number; total: number }[];
  /** Set when the return is part of an exchange. */
  exchangeInvoiceId?: number | null;
  exchangeInvoiceNumber?: string | null;
}

// ---------------------------------------------------------------- reports (ADMIN-only)

export interface SalesReport {
  from: string;
  to: string;
  summary: {
    invoiceCount: number;
    grossSales: number;
    discounts: number;
    returns: number;
    netSales: number;
    /** At the products' current cost price. */
    costOfSales: number;
    grossProfit: number;
    profitMarginPercent: number;
    cashIn: number;
    customerPayments: number;
    purchases: number;
    /** What all customers owe now. */
    outstandingBalances: number;
    linesWithoutCost: number;
    /** Shop expenses dated in the range. */
    expenses: number;
    /** Gross profit minus expenses. */
    netProfit: number;
  };
  days: { date: string; invoices: number; sales: number; returns: number; net: number; profit: number }[];
  topProducts: { productId: number; name: string; code?: string | null; quantity: number; revenue: number; profit: number }[];
  slowMovers: { productId: number; name: string; code?: string | null; stock: number; stockValue?: number | null; lastSaleAt?: string | null }[];
  paymentMethods: { method: PaymentMethod; invoices: number; paid: number }[];
  stocktakes: { id: number; code: string; title: string; approvedAt: string; shortageCost?: number | null; surplusCost?: number | null }[];
  expenses: { category: ExpenseCategory; count: number; amount: number }[];
}

// ---------------------------------------------------------------- suppliers & expenses (ADMIN-only)

export interface Supplier {
  id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  active: boolean;
  /** What we owe this supplier now. */
  balance: number;
  createdAt: string;
}

export interface SupplierInput {
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface SupplierPayment {
  id: number;
  paymentNumber: string;
  supplierId: number;
  supplierName: string;
  branchId?: number | null;
  amount: number;
  paymentMethod: PaymentMethod;
  notes?: string | null;
  paidByName?: string | null;
  createdAt: string;
  balanceAfter?: number | null;
}

export interface SupplierAccount {
  supplierId: number;
  supplierName: string;
  balance: number;
  purchasesTotal: number;
  paidAtPurchase: number;
  laterPayments: number;
  entries: { type: 'PURCHASE' | 'PAYMENT'; id: number; number: string; date: string; description: string; amount: number; balanceAfter: number }[];
}

export type ExpenseCategory =
  | 'RENT' | 'SALARIES' | 'ELECTRICITY' | 'WATER' | 'PHONE_INTERNET' | 'TRANSPORT'
  | 'MAINTENANCE' | 'MARKETING' | 'SUPPLIES' | 'TAXES' | 'OTHER';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'RENT', label: 'إيجار' },
  { value: 'SALARIES', label: 'رواتب' },
  { value: 'ELECTRICITY', label: 'كهرباء' },
  { value: 'WATER', label: 'مياه' },
  { value: 'PHONE_INTERNET', label: 'تليفون وإنترنت' },
  { value: 'TRANSPORT', label: 'نقل ومواصلات' },
  { value: 'MAINTENANCE', label: 'صيانة' },
  { value: 'MARKETING', label: 'دعاية وإعلان' },
  { value: 'SUPPLIES', label: 'مستلزمات' },
  { value: 'TAXES', label: 'ضرائب ورسوم' },
  { value: 'OTHER', label: 'أخرى' },
];

export const expenseCategoryLabel = (c: ExpenseCategory) => EXPENSE_CATEGORIES.find((x) => x.value === c)?.label ?? c;

export interface Expense {
  id: number;
  expenseNumber: string;
  category: ExpenseCategory;
  description?: string | null;
  amount: number;
  paymentMethod: PaymentMethod;
  /** yyyy-MM-dd */
  expenseDate: string;
  branchId?: number | null;
  createdByName?: string | null;
  createdAt: string;
}

export interface ExpenseInput {
  branchId: number;
  category: ExpenseCategory;
  description?: string | null;
  amount: number;
  paymentMethod: PaymentMethod;
  expenseDate: string;
}

// ---------------------------------------------------------------- installments

export type InstallmentStatus = 'PAID' | 'PARTIAL' | 'DUE' | 'OVERDUE';

export interface InstallmentPlan {
  id: number;
  invoiceId: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  customerPhone?: string | null;
  principal: number;
  markupPercent: number;
  markupAmount: number;
  totalAmount: number;
  months: number;
  firstDueDate: string;
  paid: number;
  remaining: number;
  installments: { id: number; seq: number; dueDate: string; amount: number; paidAmount: number; remaining: number; status: InstallmentStatus; daysLate: number }[];
}

export interface DueInstallment {
  installmentId: number;
  planId: number;
  invoiceId: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  customerPhone?: string | null;
  seq: number;
  months: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remaining: number;
  daysLate: number;
}
