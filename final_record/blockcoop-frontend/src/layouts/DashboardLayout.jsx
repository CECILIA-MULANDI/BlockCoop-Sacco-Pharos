import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';

export default function DashboardLayout({ children, role }) {
  const navigate = useNavigate();

  const menuItems = {
    owner: [
      { name: 'Overview', path: '/owner-dashboard' },
      { name: 'Fund Managers', path: '/owner-dashboard/managers' },
      { name: 'Tokens', path: '/owner-dashboard/tokens' },
    ],
    fundManager: [
      { name: 'Overview', path: '/fund-manager' },
      { name: 'Price Feeds', path: '/fund-manager/price-feeds' },
      { name: 'Analytics', path: '/fund-manager/analytics' },
    ],
    user: [
      { name: 'Overview', path: '/dashboard' },
      { name: 'Deposits', path: '/dashboard/deposits' },
      { name: 'Withdrawals', path: '/dashboard/withdrawals' },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-lg min-h-screen">
          <nav className="mt-16 px-4 py-6">
            <div className="space-y-1">
              {menuItems[role].map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-gray-900 rounded-md hover:bg-blue-50 hover:text-blue-700"
                >
                  {item.name}
                </button>
              ))}
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 mt-16 p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
