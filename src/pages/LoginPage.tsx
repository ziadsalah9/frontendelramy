import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sofa, Loader2, Eye, EyeOff, Lock, User } from 'lucide-react';
import { authService } from '@/api/auth';
import { extractApiError } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  //const { setUser } = useAuth();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authService.login({ username, password });
        // setUser(res.user);
login(res);

      
      navigate('/', { replace: true });
    } catch (err) {
      const apiError = extractApiError(err);
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-72 h-72 rounded-full bg-primary blur-3xl" />
          <div className="absolute bottom-20 left-20 w-96 h-96 rounded-full bg-accent blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-20 text-white">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/30 backdrop-blur">
              <Sofa className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">مفروشات الرامى</h1>
              <p className="text-sm text-white/60">نظام إدارة المتجر</p>
            </div>
          </div>
          <h2 className="text-4xl font-bold leading-tight mb-4">
            لوحة التحكم الإدارية
          </h2>
          <p className="text-lg text-white/70 leading-relaxed">
            إدارة شاملة للفروع والمنتجات والمخزون والفواتير من مكان واحد
          </p>
          <div className="mt-12 space-y-4">
            {['إدارة الفروع والمخزون', 'فواتير الشراء والبيع', 'تقارير وتحليلات فورية'].map((feature) => (
              <div key={feature} className="flex items-center gap-3 text-white/80">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center mb-8">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary">
                <Sofa className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">مفروشات الرميزي</h1>
                <p className="text-xs text-muted-foreground">نظام إدارة المتجر</p>
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-2xl shadow-sm p-8">
            <h2 className="text-xl font-bold text-foreground mb-2">تسجيل الدخول</h2>
            <p className="text-sm text-muted-foreground mb-6">أدخل بياناتك للوصول إلى لوحة التحكم</p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive animate-in fade-in">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">اسم المستخدم</label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                    className="w-full pr-10 pl-4 h-11 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none transition-all"
                    placeholder="أدخل اسم المستخدم"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">كلمة المرور</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pr-10 pl-10 h-11 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none transition-all"
                    placeholder="أدخل كلمة المرور"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
