import React, { useState } from 'react';
import WhitelistTokenForm from '../../components/forms/WhitelistTokenForm';
import TokenInfoDisplay from '../../forms/displayTokens';
import Header from '../../layouts/Header';

export default function FundManagerDashboard() {
  const [activeTab, setActiveTab] = useState("displayTokens");

  return (
    <div>
      <Header />
      
      {/* Fund Manager navbar */}
      <div className="bg-blue-500 text-white shadow-lg mb-6">
        <div className="container mx-auto px-4">
          <div className="py-4">
            <h2 className="text-xl font-bold">Fund Manager Dashboard</h2>
            <p className="text-white/80 text-sm">Welcome, Fund Manager</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        {/* Tab navigation */}
        <div className="mb-6 border-b border-gray-200">
          <ul className="flex flex-wrap -mb-px">
            <li className="mr-2">
              <button
                className={`inline-block p-4 border-b-2 rounded-t-lg ${
                  activeTab === "displayTokens"
                    ? "text-blue-500 border-blue-500"
                    : "border-transparent hover:text-gray-600 hover:border-gray-300"
                }`}
                onClick={() => setActiveTab("displayTokens")}
              >
                Display Whitelisted Tokens
              </button>
            </li>
            <li className="mr-2">
              <button
                className={`inline-block p-4 border-b-2 rounded-t-lg ${
                  activeTab === "whitelist"
                    ? "text-blue-500 border-blue-500"
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
          <div>
            <h3 className="text-lg font-medium mb-4">Whitelist New Tokens</h3>
            <WhitelistTokenForm />
          </div>
        )}

        {activeTab === "displayTokens" && <TokenInfoDisplay />}
      </div>
    </div>
  );
}
