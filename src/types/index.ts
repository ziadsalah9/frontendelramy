export type UserRole = 'ADMIN' | 'EMPLOYEE';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT';
export type TransferStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

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
}

export interface BranchCreateInput {
  name: string;
  address?: string;
  phone?: string;
}

export type ProductType =
  | 'لحاف' | 'بطانيه' | 'طقم' | 'فوط' | 'دفاية' | 'برنس'
  | 'مفارش' | 'حافظة' | 'مشاية' | 'كوفرتة' | 'مصلية' | 'نيش'
  | 'سفرة' | 'انترية' | 'سراحة' | 'OTHER';

export const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: 'لحاف', label: 'لحاف' },
  { value: 'بطانيه', label: 'بطانيه' },
  { value: 'طقم', label: 'طقم' },
  { value: 'فوط', label: 'فوط' },
  { value: 'دفاية', label: 'دفاية' },
  { value: 'برنس', label: 'برنس' },
  { value: 'مفارش', label: 'مفارش' },
  { value: 'حافظة', label: 'حافظة' },
  { value: 'مشاية', label: 'مشاية' },
  { value: 'كوفرتة', label: 'كوفرتة' },
  { value: 'مصلية', label: 'مصلية' },
  { value: 'نيش', label: 'نيش' },
  { value: 'سفرة', label: 'سفرة' },
  { value: 'انترية', label: 'انترية' },
  { value: 'سراحة', label: 'سراحة' },
  { value: 'OTHER', label: 'أخرى' },
];

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

export const PRODUCT_SIZES: { value: string; label: string }[] = [
  { value: 'صغير', label: 'صغير' },
  { value: 'وسط', label: 'وسط' },
  { value: 'كبير', label: 'كبير' },
  { value: 'مزدوج', label: 'مزدوج' },
  { value: 'كينج', label: 'كينج' },
  { value: 'سوبر كينج', label: 'سوبر كينج' },
  { value: 'قطعة واحدة', label: 'قطعة واحدة' },
  { value: 'طقم 2', label: 'طقم 2 قطع' },
  { value: 'طقم 3', label: 'طقم 3 قطع' },
  { value: 'طقم 4', label: 'طقم 4 قطع' },
  { value: 'طقم 5', label: 'طقم 5 قطع' },
  { value: 'طقم 6', label: 'طقم 6 قطع' },
  { value: 'طقم 7', label: 'طقم 7 قطع' },
  { value: 'حجم واحد', label: 'حجم واحد' },
];

export interface Product {
  id: number;
  code?: string;
  name: string;
  itemType: ProductType;
  color: string;
  size: string;
  model?: string;
  barcode?: string;
  minimumQuantity: number;
}

export interface ProductCreateInput {
  name: string;
  itemType: ProductType;
  color: string;
  size: string;
  model?: string;
  minimumQuantity: number;
}

export interface ProductPrice {
  id: number;
  productId: number;
  purchasePrice: number;
  sellingPrice: number;
  profitPercentage?: number;
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
  address?: string;
  status?: string;
}

export interface CustomerCreateInput {
  name: string;
  phone: string;
  address?: string;
}

export interface Stock {
  id: number;
  productId: number;
  branchId: number;
  quantity: number;
  minimumQuantity?: number;
  productName?: string;
  branchName?: string;
}

export interface StockTransaction {
  id: number;
  stockId?: number;
  productId?: number;
  branchId?: number;
  quantity: number;
  type: string;
  reason?: string;
  reference?: string;
  createdAt: string;
}

export interface StockAdjustment {
  id: number;
  branchId: number;
  productId: number;
  quantity: number;
  reason: string;
  notes?: string;
  createdAt?: string;
  branchName?: string;
  productName?: string;
}

export interface StockAdjustmentCreateInput {
  branchId: number;
  productId: number;
  quantity: number;
  reason: string;
  notes?: string;
}

export interface TransferItem {
  id: number;
  transferId: number;
  productId: number;
  quantity: number;
  productName?: string;
}

export interface BranchTransfer {
  id: number;
  transferNumber?: string;
  fromBranchId: number;
  toBranchId: number;
  status: TransferStatus;
  notes?: string;
  createdAt: string;
  items: TransferItem[];
  fromBranchName?: string;
  toBranchName?: string;
}

export interface BranchTransferCreateInput {
  fromBranchId: number;
  toBranchId: number;
  notes?: string;
  items: { productId: number; quantity: number }[];
}

export interface InvoiceItem {
  id: number;
  productId: number;
  quantity: number;
  unitPrice?: number;
  discount: number;
  productName?: string;
  total?: number;
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
}

export interface PurchaseInvoiceCreateInput {
  invoiceNumber: string;
  branchId: number;
  items: { productId: number; quantity: number; unitPrice: number; discount: number }[];
  discount: number;
  paid: number;
  paymentMethod: PaymentMethod;
  notes?: string;
}

export interface SalesInvoice {
  id: number;
  invoiceNumber: string;
  branchId: number;
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
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
}

export interface SalesInvoiceCreateInput {
  branchId: number;
  customer: { name: string; phone: string; address?: string };
  paymentMethod: PaymentMethod;
  items: { productId: number; quantity: number; discount: number }[];
  discount: number;
  paid: number;
  notes?: string;
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
  active: boolean;
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