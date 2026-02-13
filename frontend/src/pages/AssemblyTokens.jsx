import React, { useState, useEffect } from 'react';
import { AssemblyTokenAPI, UsersAPI } from '../services/api';
import { Modal, AlertModal, ConfirmModal } from '../components/Modal';

const AssemblyTokens = () => {
  const [tokens, setTokens] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingToken, setEditingToken] = useState(null);
  const [formData, setFormData] = useState({ user_id: '', api_key: '' });
  const [alertOpen, setAlertOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertTitle, setAlertTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmCallback, setConfirmCallback] = useState(null);
  const [showApiKey, setShowApiKey] = useState({});

  useEffect(() => {
    loadAssemblyTokens();
    loadUsers();
  }, []);

  const loadAssemblyTokens = async () => {
    try {
      setLoading(true);
      const data = await AssemblyTokenAPI.getAll();
      setTokens(data.tokens || []);
    } catch (error) {
      showAlert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await UsersAPI.getAll();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const showAlert = (title, message) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertOpen(true);
  };

  const showConfirm = (title, message, callback) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmCallback(() => callback);
    setConfirmOpen(true);
  };

  const handleAddToken = () => {
    setEditingToken(null);
    setFormData({ user_id: '', api_key: '' });
    setModalOpen(true);
  };

  const handleEditToken = (tokenItem) => {
    setEditingToken(tokenItem);
    setFormData({ 
      user_id: tokenItem.user_id.toString(), 
      api_key: tokenItem.api_key 
    });
    setModalOpen(true);
  };

  const handleSaveToken = async (e) => {
    e.preventDefault();
    try {
      if (editingToken) {
        await AssemblyTokenAPI.update(editingToken.id, parseInt(formData.user_id), formData.api_key);
        showAlert('Success', 'Assembly token updated successfully!');
      } else {
        await AssemblyTokenAPI.create(parseInt(formData.user_id), formData.api_key);
        showAlert('Success', 'Assembly token added successfully!');
      }
      setModalOpen(false);
      loadAssemblyTokens();
    } catch (error) {
      showAlert('Error', error.message);
    }
  };

  const handleDeleteToken = (tokenItem) => {
    const userName = tokenItem.user_name || tokenItem.user_email || 'Unknown User';
    showConfirm(
      'Delete Assembly Token', 
      `Are you sure you want to delete the assembly token for ${userName}?`, 
      async () => {
        try {
          await AssemblyTokenAPI.delete(tokenItem.id);
          showAlert('Success', 'Assembly token deleted successfully!');
          loadAssemblyTokens();
        } catch (error) {
          showAlert('Error', error.message);
        }
      }
    );
  };

  const toggleApiKeyVisibility = (tokenId) => {
    setShowApiKey(prev => ({
      ...prev,
      [tokenId]: !prev[tokenId]
    }));
  };

  const maskApiKey = (apiKey) => {
    if (!apiKey) return '';
    if (apiKey.length <= 8) return '••••••••';
    return apiKey.substring(0, 4) + '••••••••' + apiKey.substring(apiKey.length - 4);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Assembly Tokens</h1>
        <div className="flex gap-2">
          <button
            onClick={loadAssemblyTokens}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
          >
            🔄 Refresh
          </button>
          <button
            onClick={handleAddToken}
            className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark"
          >
            + Add Assembly Token
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {loading ? (
          <div className="text-center py-8">Loading assembly tokens...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">User Email</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">API Key</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created At</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated At</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tokens.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                        No assembly tokens found
                      </td>
                    </tr>
                  ) : (
                    tokens.map((tokenItem) => (
                      <tr key={tokenItem.id}>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-900">{tokenItem.id}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-900">
                          {tokenItem.user_name || 'N/A'}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-900">
                          {tokenItem.user_email || 'N/A'}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center gap-2">
                            <span className="font-mono">
                              {showApiKey[tokenItem.id] ? tokenItem.api_key : maskApiKey(tokenItem.api_key)}
                            </span>
                            <button
                              onClick={() => toggleApiKeyVisibility(tokenItem.id)}
                              className="text-blue-600 hover:text-blue-900 text-xs"
                              title={showApiKey[tokenItem.id] ? 'Hide' : 'Show'}
                            >
                              {showApiKey[tokenItem.id] ? '👁️' : '👁️‍🗨️'}
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(tokenItem.created_at).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">
                          {tokenItem.updated_at ? new Date(tokenItem.updated_at).toLocaleString() : 'N/A'}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditToken(tokenItem)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteToken(tokenItem)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingToken ? 'Edit Assembly Token' : 'Add Assembly Token'}
      >
        <form onSubmit={handleSaveToken}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">User *</label>
            <select
              required
              value={formData.user_id}
              onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select a user</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Select the user this assembly token belongs to.
            </p>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key *</label>
            <input
              type="text"
              required
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              placeholder="Enter assembly API key"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter the Assembly AI API key for this user.
            </p>
          </div>
          <button
            type="submit"
            className="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary-dark"
          >
            {editingToken ? 'Update Assembly Token' : 'Add Assembly Token'}
          </button>
        </form>
      </Modal>

      <AlertModal
        isOpen={alertOpen}
        onClose={() => setAlertOpen(false)}
        title={alertTitle}
        message={alertMessage}
      />

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={confirmTitle}
        message={confirmMessage}
        onConfirm={confirmCallback}
      />
    </div>
  );
};

export default AssemblyTokens;

