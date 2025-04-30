import React, { useState } from 'react';
import WhitelistTokenForm from '../../components/forms/WhitelistTokenForm';
import TokenInfoDisplay from '../../forms/displayTokens';
import Header from '../../layouts/Header';

export default function FundManagerDashboard() {
  const [activeTab, setActiveTab] = useState("displayTokens");

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      
      {/* Fund Manager navbar */}
      <div className="bg-gray-800 text-white shadow-lg mb-6">
        <div className="container mx-auto px-4">
          <div className="py-4">
            <h2 className="text-xl font-bold text-white">Fund Manager Dashboard</h2>
            <p className="text-white/80 text-sm">Welcome, Fund Manager</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        {/* Tab navigation */}
        <div className="mb-6 border-b border-gray-700">
          <ul className="flex flex-wrap -mb-px">
            <li className="mr-2">
              <button
                className={`inline-block p-4 border-b-2 rounded-t-lg text-white ${
                  activeTab === "displayTokens"
                    ? "border-white"
                    : "border-transparent hover:text-gray-600 hover:border-gray-300"
                }`}
                onClick={() => setActiveTab("displayTokens")}
              >
                Display Whitelisted Tokens
              </button>
            </li>
            <li className="mr-2">
              <button
                className={`inline-block p-4 border-b-2 rounded-t-lg text-white ${
                  activeTab === "whitelist"
                    ? "border-white"
                    : "border-transparent hover:text-gray-600 hover:border-gray-300"
                }`}
                onClick={() => setActiveTab("whitelist")}
              >
                Whitelist New Tokens
              </button>
            </li>
          </ul>
        </div>

        {/* Tab content */}
        {activeTab === "whitelist" && (
          <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-medium mb-4 text-white">Whitelist New Tokens</h3>
            <WhitelistTokenForm />
          </div>
        )}

        {activeTab === "displayTokens" && (
          <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <TokenInfoDisplay />
          </div>
        )}
      </div>
    </div>
  );
}
