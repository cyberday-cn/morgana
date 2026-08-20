import { useState, useEffect } from 'react'
import { useAgentStore } from '../../stores/useAgentStore'
import { useNLStore } from '../../stores/useNLStore'
import type { AgentConfigForm, AgentProtocol } from '../../types'

type ViewMode = 'list' | 'form'

export function AgentConfigDialog() {
  const {
    showDialog, editingConfig, configs, loading,
    closeDialog, createConfig, updateConfig, deleteConfig, activateConfig, fetchConfigs, setEditingConfig, error,
    initializeAgent, fetchDefaultInitPrompt, fetchDefaultChatPrompt, fetchDefaultPagePrompt, fetchDefaultEmergePrompt,
  } = useAgentStore()
  const nlStore = useNLStore()

  const [view, setView] = useState<ViewMode>('list')
  const [form, setForm] = useState<AgentConfigForm>({
    name: '', protocol: 'acp', endpoint: '', api_key: '', description: '', init_prompt: '', chat_prompt: '', page_prompt: '', emerge_prompt: '',
  })
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Fetch configs when dialog opens
  useEffect(() => {
    if (showDialog) {
      setView('list')
      fetchConfigs()
    }
  }, [showDialog, fetchConfigs])

  // Reset form when editing config changes
  useEffect(() => {
    if (editingConfig) {
      setForm({
        name: editingConfig.name,
        protocol: editingConfig.protocol,
        endpoint: editingConfig.endpoint,
        api_key: editingConfig.api_key ?? '',
        description: editingConfig.description ?? '',
        init_prompt: '',
        chat_prompt: '',
        page_prompt: '',
        emerge_prompt: '',
      })
      setShowAdvanced(true) // auto-expand to show the prompts

      // If no custom init prompt saved yet, fetch and pre-fill the default
      if (!editingConfig.init_prompt) {
        const agentId = editingConfig.id
        fetchDefaultInitPrompt(agentId).then((defaultPrompt) => {
          if (defaultPrompt) {
            setForm((prev) => prev.name === '' ? prev : { ...prev, init_prompt: defaultPrompt })
          }
        })
      } else {
        setForm((prev) => ({ ...prev, init_prompt: editingConfig.init_prompt ?? '' }))
      }

      // If no custom chat prompt saved yet, fetch and pre-fill the default
      if (!editingConfig.chat_prompt) {
        const agentId = editingConfig.id
        fetchDefaultChatPrompt(agentId).then((defaultPrompt) => {
          if (defaultPrompt) {
            setForm((prev) => prev.name === '' ? prev : { ...prev, chat_prompt: defaultPrompt })
          }
        })
      } else {
        setForm((prev) => ({ ...prev, chat_prompt: editingConfig.chat_prompt ?? '' }))
      }

      // If no custom page prompt saved yet, fetch and pre-fill the default
      if (!editingConfig.page_prompt) {
        const agentId = editingConfig.id
        fetchDefaultPagePrompt(agentId).then((defaultPrompt) => {
          if (defaultPrompt) {
            setForm((prev) => prev.name === '' ? prev : { ...prev, page_prompt: defaultPrompt })
          }
        })
      } else {
        setForm((prev) => ({ ...prev, page_prompt: editingConfig.page_prompt ?? '' }))
      }

      // If no custom emerge prompt saved yet, fetch and pre-fill the default
      if (!editingConfig.emerge_prompt) {
        const agentId = editingConfig.id
        fetchDefaultEmergePrompt(agentId).then((defaultPrompt) => {
          if (defaultPrompt) {
            setForm((prev) => prev.name === '' ? prev : { ...prev, emerge_prompt: defaultPrompt })
          }
        })
      } else {
        setForm((prev) => ({ ...prev, emerge_prompt: editingConfig.emerge_prompt ?? '' }))
      }
    } else {
      setForm({ name: '', protocol: 'acp', endpoint: '', api_key: '', description: '', init_prompt: '', chat_prompt: '', page_prompt: '', emerge_prompt: '' })
    }
    setLocalError(null)
  }, [editingConfig, fetchDefaultInitPrompt, fetchDefaultChatPrompt, fetchDefaultPagePrompt, fetchDefaultEmergePrompt])

  if (!showDialog) return null

  // ---- Form View ----

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.endpoint.trim()) {
      setLocalError('名称和端点地址为必填项')
      return
    }
    setSaving(true)
    setLocalError(null)
    try {
      if (editingConfig) {
        await updateConfig(editingConfig.id, form)
      } else {
        await createConfig(form)
      }
      setView('list')
      fetchConfigs()
    } catch {
      setLocalError('保存失败，请检查后端服务是否运行')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelForm = () => {
    setEditingConfig(null)
    setView('list')
    setLocalError(null)
    setShowAdvanced(false)
  }

  // ---- List View ----

  const handleNew = () => {
    setEditingConfig(null)
    setView('form')
    setLocalError(null)
    setForm({ name: '', protocol: 'acp', endpoint: '', api_key: '', description: '', init_prompt: '', chat_prompt: '', page_prompt: '', emerge_prompt: '' })
  }

  const handleEdit = (config: any) => {
    setEditingConfig(config)
    setView('form')
  }

  const handleDelete = async (id: number) => {
    if (confirm('确定删除此 Agent 配置？')) {
      await deleteConfig(id)
    }
  }

  const handleInitialize = async (cfg: any) => {
    if (isInitializing) return

    // Confirm re-init if already initialized
    if (cfg.initialized && !confirm('该 Agent 已初始化，是否重新初始化？')) {
      return
    }

    setIsInitializing(true)
    try {
      // 1. Activate this agent
      await activateConfig(cfg.id)

      // 2. Create init task
      const result = await initializeAgent(cfg.id)
      if (!result || !result.task) {
        throw new Error('创建初始化任务失败')
      }

      // 3. Close dialog
      closeDialog()

      // 4. Switch to the init task in NL
      const task = result.task
      await nlStore.fetchTasks()
      nlStore.selectTask(task.id)
      nlStore.setSidebarExpanded(true)
      await nlStore.loadTaskMessages(task.id)

      // 5. Send init message
      await nlStore.sendInitMessage(task.id, cfg.id)
    } catch (err) {
      console.error('初始化失败:', err)
    } finally {
      setIsInitializing(false)
    }
  }

  const handleResetPrompt = async () => {
    if (!editingConfig) return
    const defaultPrompt = await fetchDefaultInitPrompt(editingConfig.id)
    if (defaultPrompt) {
      setForm((prev) => ({ ...prev, init_prompt: defaultPrompt }))
    }
  }

  const handleResetChatPrompt = async () => {
    if (!editingConfig) return
    const defaultPrompt = await fetchDefaultChatPrompt(editingConfig.id)
    if (defaultPrompt) {
      setForm((prev) => ({ ...prev, chat_prompt: defaultPrompt }))
    }
  }

  const handleResetPagePrompt = async () => {
    if (!editingConfig) return
    const defaultPrompt = await fetchDefaultPagePrompt(editingConfig.id)
    if (defaultPrompt) {
      setForm((prev) => ({ ...prev, page_prompt: defaultPrompt }))
    }
  }

  const handleResetEmergePrompt = async () => {
    if (!editingConfig) return
    const defaultPrompt = await fetchDefaultEmergePrompt(editingConfig.id)
    if (defaultPrompt) {
      setForm((prev) => ({ ...prev, emerge_prompt: defaultPrompt }))
    }
  }

  const renderListView = () => (
    <>
      <div className="dialog-header">
        <h3 className="dialog-title">Agent 配置管理</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={handleNew}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              新建配置
            </span>
          </button>
          <button className="dialog-close" onClick={closeDialog}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="dialog-body">
        {loading && <div className="dialog-loading">加载中...</div>}

        {!loading && configs.length === 0 && (
          <div className="dialog-empty">
            <div className="dialog-empty-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <p className="dialog-empty-text">暂无 Agent 配置</p>
            <p className="dialog-empty-hint">点击上方「新建配置」添加一个 AI Agent 对接</p>
          </div>
        )}

        {!loading && configs.length > 0 && (
          <div className="config-list">
            {configs.map((cfg) => (
              <div key={cfg.id} className={`config-card ${cfg.is_active ? 'active' : ''}`}>
                <div className="config-card-main">
                  <div className="config-card-header">
                    <span className="config-card-name">{cfg.name}</span>
                    {cfg.is_active && <span className="config-card-badge">当前使用</span>}
                    {cfg.initialized ? <span className="config-card-badge badge-init">已初始化</span> : <span className="config-card-badge badge-not-init">未初始化</span>}
                  </div>
                  <div className="config-card-meta">
                    <span className="config-card-tag">{cfg.protocol === 'acp' ? 'ACP' : 'API Server'}</span>
                    <span className="config-card-endpoint">{cfg.endpoint}</span>
                  </div>
                  {cfg.description && (
                    <div className="config-card-desc">{cfg.description}</div>
                  )}
                </div>
                <div className="config-card-actions">
                  {!cfg.is_active && (
                    <button className="btn-card btn-activate" onClick={() => activateConfig(cfg.id)}
                      title="设为当前使用的 Agent">启用</button>
                  )}
                  <button
                    className={`btn-card ${cfg.initialized ? 'btn-reinit' : 'btn-init'}`}
                    onClick={() => handleInitialize(cfg)}
                    disabled={isInitializing}
                    title={cfg.initialized ? '重新初始化' : '初始化基础设施'}>
                    {isInitializing ? '初始化中...' : cfg.initialized ? '重新初始化' : '初始化'}
                  </button>
                  <button className="btn-card btn-edit" onClick={() => handleEdit(cfg)}
                    title="编辑配置">编辑</button>
                  <button className="btn-card btn-delete" onClick={() => handleDelete(cfg.id)}
                    title="删除配置">删除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )

  const renderFormView = () => {
    const displayError = localError || error

    return (
      <>
        <div className="dialog-header">
          <h3 className="dialog-title">{editingConfig ? '编辑 Agent 配置' : '新建 Agent 配置'}</h3>
          <button className="dialog-close" onClick={handleCancelForm}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {displayError && <div className="dialog-error">{displayError}</div>}

        <form className="dialog-body" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">名称</label>
            <input
              className="form-input"
              type="text"
              placeholder="例如：本地 Hermes Agent"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">协议类型</label>
            <div className="protocol-options">
              <label className={`protocol-option ${form.protocol === 'acp' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="protocol"
                  value="acp"
                  checked={form.protocol === 'acp'}
                  onChange={() => setForm({ ...form, protocol: 'acp' as AgentProtocol })}
                />
                <span className="protocol-label">
                  <strong>ACP</strong>
                  <span className="protocol-desc">Agent Communication Protocol，适合对接远端 Agent</span>
                </span>
              </label>
              <label className={`protocol-option ${form.protocol === 'api-server' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="protocol"
                  value="api-server"
                  checked={form.protocol === 'api-server'}
                  onChange={() => setForm({ ...form, protocol: 'api-server' as AgentProtocol })}
                />
                <span className="protocol-label">
                  <strong>API Server</strong>
                  <span className="protocol-desc">标准 REST API，适合对接本地 Agent</span>
                </span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">端点地址</label>
            <input
              className="form-input"
              type="url"
              placeholder={form.protocol === 'acp' ? 'https://remote-agent.example.com/acp' : 'http://localhost:8080'}
              value={form.endpoint}
              onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
            />
            <span className="form-hint">
              {form.protocol === 'acp'
                ? 'ACP 协议的服务端点地址'
                : 'API Server 的完整 URL 地址'}
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">API Key <span className="form-optional">（可选）</span></label>
            <input
              className="form-input"
              type="password"
              placeholder="如有认证要求请填写"
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">描述 <span className="form-optional">（可选）</span></label>
            <textarea
              className="form-input form-textarea"
              placeholder="关于此 Agent 配置的说明..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>

          {/* Collapsible: Advanced Settings */}
          <div className="form-advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: showAdvanced ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span>高级设置</span>
          </div>

          {showAdvanced && (
            <div className="form-advanced-section">
              <div className="form-group">
                <div className="form-label-row">
                  <label className="form-label">对话 System Prompt</label>
                  {editingConfig && (
                    <button type="button" className="btn-reset-prompt" onClick={handleResetChatPrompt}>
                      重置默认
                    </button>
                  )}
                </div>
                <textarea
                  className="form-input form-textarea form-textarea-prompt"
                  placeholder="留空则使用默认提示词。自定义 Agent 在对话中的行为，系统信息会自动附加在末尾。"
                  value={form.chat_prompt}
                  onChange={(e) => setForm({ ...form, chat_prompt: e.target.value })}
                  rows={10}
                />
                <span className="form-hint">留空 = 使用默认提示词。对话结束后系统会自动生成展示页面，Agent 只需专注文字对话。</span>
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <div className="form-label-row">
                  <label className="form-label">配置 System Prompt</label>
                  {editingConfig && (
                    <button type="button" className="btn-reset-prompt" onClick={handleResetPrompt}>
                      重置默认
                    </button>
                  )}
                </div>
                <textarea
                  className="form-input form-textarea form-textarea-prompt"
                  placeholder="留空则使用默认提示词。填写后将替换默认提示词作为初始化指令发送给 Agent，系统配置信息（数据库连接、页面路径等）会自动附加在末尾。"
                  value={form.init_prompt}
                  onChange={(e) => setForm({ ...form, init_prompt: e.target.value })}
                  rows={10}
                />
                <span className="form-hint">留空 = 使用默认提示词。自定义内容中无需包含数据库连接等信息，系统会自动附加。</span>
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <div className="form-label-row">
                  <label className="form-label">页面 System Prompt</label>
                  {editingConfig && (
                    <button type="button" className="btn-reset-prompt" onClick={handleResetPagePrompt}>
                      重置默认
                    </button>
                  )}
                </div>
                <textarea
                  className="form-input form-textarea form-textarea-prompt"
                  placeholder="留空则使用默认提示词。自定义 Agent 在生成固定页面时的行为，系统信息（页面路径、SDK 地址等）会自动附加在末尾。"
                  value={form.page_prompt}
                  onChange={(e) => setForm({ ...form, page_prompt: e.target.value })}
                  rows={10}
                />
                <span className="form-hint">留空 = 使用默认提示词。可告知 Agent 如何生成固定页面和集成 SDK 操作数据库。</span>
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <div className="form-label-row">
                  <label className="form-label">涌现 System Prompt</label>
                  {editingConfig && (
                    <button type="button" className="btn-reset-prompt" onClick={handleResetEmergePrompt}>
                      重置默认
                    </button>
                  )}
                </div>
                <textarea
                  className="form-input form-textarea form-textarea-prompt"
                  placeholder="留空则使用默认提示词。自定义点击「生成页面」按钮时触发 Agent 生成涌现页面的行为，系统信息（页面路径、SDK 地址、刷新回调等）会自动附加在末尾。"
                  value={form.emerge_prompt}
                  onChange={(e) => setForm({ ...form, emerge_prompt: e.target.value })}
                  rows={10}
                />
                <span className="form-hint">留空 = 使用默认提示词。点击任务对话中"生成页面"按钮时使用此提示词驱动 Agent。</span>
              </div>
            </div>
          )}

          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={handleCancelForm}>取消</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '保存中...' : editingConfig ? '更新配置' : '创建配置'}
            </button>
          </div>
        </form>
      </>
    )
  }

  return (
    <div className="dialog-overlay" onClick={closeDialog}>
      <div className="dialog-panel agent-config-dialog" onClick={(e) => e.stopPropagation()}>
        {view === 'list' ? renderListView() : renderFormView()}
      </div>
    </div>
  )
}
