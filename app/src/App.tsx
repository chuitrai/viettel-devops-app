/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  ShoppingCart, 
  User, 
  LogOut, 
  Plus, 
  Trash2, 
  Search,
  Package,
  CreditCard,
  ShieldCheck,
  Activity,
  AlertCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  image: string;
}

interface UserInfo {
  username: string;
  role: string;
}

export default function App() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Product[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkoutStatus, setCheckoutStatus] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    fetchProducts();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch (err) {
      console.error('Auth check failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Failed to fetch products');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setIsLoginOpen(false);
      } else {
        setError('Invalid credentials');
      }
    } catch (err) {
      setError('Login failed');
    }
  };

  const handleLogout = () => {
    document.cookie = 'token=; Max-Age=0; path=/;';
    setUser(null);
    setCart([]);
  };

  const addToCart = (product: Product) => {
    setCart([...cart, product]);
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const handleCheckout = async () => {
    if (!user) {
      setIsLoginOpen(true);
      return;
    }
    setCheckoutStatus(null);
    try {
      const total = cart.reduce((acc, item) => acc + item.price, 0);
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total_amount: total }),
      });
      if (res.ok) {
        setCart([]);
        setCheckoutStatus('Order placed successfully!');
        setTimeout(() => setCheckoutStatus(null), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Checkout failed');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      setError('Checkout failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-zinc-400">
        <div className="animate-pulse">Loading VDT Store...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* Navigation */}
      <nav className="bg-white border-b border-zinc-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">VDT <span className="text-indigo-600">Store</span></span>
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center bg-zinc-100 rounded-full px-4 py-2 border border-zinc-200">
                <Search className="w-4 h-4 text-zinc-400 mr-2" />
                <input type="text" placeholder="Search products..." className="bg-transparent text-sm outline-none w-48" />
              </div>

              <button 
                onClick={() => setIsCartOpen(true)}
                className="relative p-2 text-zinc-600 hover:text-indigo-600 transition-colors"
              >
                <ShoppingCart className="w-6 h-6" />
                {cart.length > 0 && (
                  <span className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                    {cart.length}
                  </span>
                )}
              </button>

              {user ? (
                <div className="flex items-center gap-4 pl-4 border-l border-zinc-200">
                  <div className="text-right">
                    <div className="text-sm font-semibold">{user.username}</div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">{user.role}</div>
                  </div>
                  <button onClick={handleLogout} className="p-2 text-zinc-400 hover:text-red-500 transition-colors">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsLoginOpen(true)}
                  className="flex items-center gap-2 bg-zinc-900 text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
                >
                  <User className="w-4 h-4" />
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-indigo-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-extrabold text-white sm:text-5xl"
          >
            Modern DevOps Infrastructure
          </motion.h2>
          <p className="mt-4 text-xl text-indigo-100 max-w-2xl mx-auto">
            Get the best cloud resources and education to scale your applications with confidence.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold">Featured Products</h3>
          <div className="flex gap-2">
            {['All', 'Infrastructure', 'Education', 'Tools'].map(cat => (
              <button key={cat} className="px-4 py-1.5 rounded-full text-sm font-medium bg-white border border-zinc-200 hover:border-indigo-600 hover:text-indigo-600 transition-all">
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {products.map((product) => (
            <motion.div 
              key={product.id}
              whileHover={{ y: -5 }}
              className="bg-white rounded-2xl overflow-hidden border border-zinc-200 shadow-sm hover:shadow-xl transition-all"
            >
              <div className="aspect-video bg-zinc-100 relative overflow-hidden">
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-3 left-3">
                  <span className="bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-zinc-600 border border-zinc-200">
                    {product.category}
                  </span>
                </div>
              </div>
              <div className="p-5">
                <h4 className="font-bold text-lg mb-1">{product.name}</h4>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-2xl font-black text-indigo-600">${product.price}</span>
                  <button 
                    onClick={() => addToCart(product)}
                    className="bg-zinc-100 hover:bg-indigo-600 hover:text-white p-3 rounded-xl transition-all"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {/* DevOps Hooks Info (Subtle) */}
      <footer className="bg-white border-t border-zinc-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-50 rounded-xl">
                <Activity className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h5 className="font-bold mb-1">Monitoring Ready</h5>
                <p className="text-sm text-zinc-500">Prometheus metrics exposed at /metrics for real-time observability.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 rounded-xl">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h5 className="font-bold mb-1">Structured Logging</h5>
                <p className="text-sm text-zinc-500">JSON logs generated for every request, ready for EFK stack integration.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-50 rounded-xl">
                <ShieldCheck className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h5 className="font-bold mb-1">Secure API</h5>
                <p className="text-sm text-zinc-500">Role-based access control and rate limiting implemented under the hood.</p>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-zinc-100 text-center text-xs text-zinc-400">
            &copy; 2025 VDT Store • Built for Cloud & DevOps Practice
          </div>
        </div>
      </footer>

      {/* Cart Sidebar */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Your Cart
                </h3>
                <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                    <ShoppingBag className="w-16 h-16 mb-4 opacity-20" />
                    <p>Your cart is empty</p>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                      <img src={item.image} className="w-16 h-16 rounded-xl object-cover" referrerPolicy="no-referrer" />
                      <div className="flex-1">
                        <div className="font-bold text-sm">{item.name}</div>
                        <div className="text-indigo-600 font-bold">${item.price}</div>
                      </div>
                      <button onClick={() => removeFromCart(idx)} className="p-2 text-zinc-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 border-t border-zinc-100 bg-zinc-50">
                <div className="flex justify-between mb-4">
                  <span className="text-zinc-500">Total Amount</span>
                  <span className="text-2xl font-black text-indigo-600">
                    ${cart.reduce((acc, item) => acc + item.price, 0).toFixed(2)}
                  </span>
                </div>
                {checkoutStatus && (
                  <div className="mb-4 p-3 bg-emerald-50 text-emerald-600 text-xs rounded-lg flex items-center gap-2 border border-emerald-100">
                    <ShieldCheck className="w-4 h-4" />
                    {checkoutStatus}
                  </div>
                )}
                {error && (
                  <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2 border border-red-100">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
                <button 
                  disabled={cart.length === 0}
                  onClick={handleCheckout}
                  className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-5 h-5" />
                  Checkout Now
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <AnimatePresence>
        {isLoginOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLoginOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-8">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8 text-indigo-600" />
                  </div>
                  <h3 className="text-2xl font-bold">Sign In</h3>
                  <p className="text-zinc-500 text-sm mt-1">Access your VDT Store account</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Username</label>
                    <input 
                      type="text" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-3 outline-none focus:border-indigo-600 transition-all"
                      placeholder="admin or user"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Password</label>
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-3 outline-none focus:border-indigo-600 transition-all"
                      placeholder="admin123 or user123"
                    />
                  </div>
                  {error && (
                    <div className="text-red-500 text-xs text-center font-medium">{error}</div>
                  )}
                  <button className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
                    Login
                  </button>
                </form>
                <div className="mt-6 text-center text-[10px] text-zinc-400">
                  Demo: admin/admin123 or user/user123
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
