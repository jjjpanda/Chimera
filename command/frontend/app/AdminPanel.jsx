import React, { useState, useEffect } from "react"
import { Table, Form, Input, Select, Button, Space, message, Modal } from "antd"
import { request } from "../js/request.js"

const AdminPanel = () => {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(false)
    const [form] = Form.useForm()
    const [editTarget, setEditTarget] = useState(null)
    const [editForm] = Form.useForm()

    const fetchUsers = () => {
        setLoading(true)
        request("/authorization/users", { method: "GET" }, p => p.then(r => r.json()).catch(() => ({ error: true })))
            .then(data => {
                if (!data.error) setUsers(data)
                setLoading(false)
            })
    }

    useEffect(() => { fetchUsers() }, [])

    const addUser = (values) => {
        request("/authorization/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values)
        }, p => p.then(r => r.json()).catch(() => ({ error: true }))).then(res => {
            if (res.error) {
                message.error("Failed to add user")
            } else {
                message.success("User added")
                form.resetFields()
                fetchUsers()
            }
        })
    }

    const updateUser = (username, values) => {
        const body = {}
        if (values.role) body.role = values.role
        if (values.password) body.password = values.password
        request(`/authorization/users/update/${encodeURIComponent(username)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        }, p => p.then(r => r.json()).catch(() => ({ error: true }))).then(res => {
            if (res.error) {
                message.error("Failed to update user")
            } else {
                message.success("User updated")
                setEditTarget(null)
                editForm.resetFields()
                fetchUsers()
            }
        })
    }

    const deleteUser = (username) => {
        request(`/authorization/users/${encodeURIComponent(username)}`, {
            method: "DELETE"
        }, p => p.then(r => r.json()).catch(() => ({ error: true }))).then(res => {
            if (res.error) {
                message.error("Cannot delete user")
            } else {
                message.success("User deleted")
                fetchUsers()
            }
        })
    }

    const columns = [
        { title: "Username", dataIndex: "username", key: "username" },
        { title: "Role", dataIndex: "role", key: "role" },
        {
            title: "Action",
            key: "action",
            render: (_, record) => (
                <Space>
                    <Button size="small" onClick={() => { setEditTarget(record); editForm.setFieldsValue({ role: record.role }) }}>
                        Edit
                    </Button>
                    <Button danger size="small" onClick={() => Modal.confirm({ title: "Delete user?", content: `Remove "${record.username}"?`, okType: "danger", onOk: () => deleteUser(record.username) })}>
                        Delete
                    </Button>
                </Space>
            )
        }
    ]

    return (
        <Space direction="vertical" style={{ width: "100%", padding: 16 }}>
            <Modal
                title={`Edit User: ${editTarget?.username}`}
                visible={!!editTarget}
                onCancel={() => { setEditTarget(null); editForm.resetFields() }}
                onOk={() => editForm.validateFields().then(values => updateUser(editTarget.username, values))}
            >
                <Form form={editForm} layout="vertical">
                    <Form.Item name="role" label="Role">
                        <Select>
                            <Select.Option value="user">user</Select.Option>
                            <Select.Option value="admin">admin</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="password" label="New Password">
                        <Input.Password placeholder="leave blank to keep current" />
                    </Form.Item>
                </Form>
            </Modal>
            <Form form={form} layout="inline" onFinish={addUser}>
                <Form.Item name="username" rules={[{ required: true }]}>
                    <Input placeholder="username" />
                </Form.Item>
                <Form.Item name="password" rules={[{ required: true }]}>
                    <Input.Password placeholder="password" />
                </Form.Item>
                <Form.Item name="role" initialValue="user" rules={[{ required: true }]}>
                    <Select style={{ width: 100 }}>
                        <Select.Option value="user">user</Select.Option>
                        <Select.Option value="admin">admin</Select.Option>
                    </Select>
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit">Add User</Button>
                </Form.Item>
            </Form>
            <Table
                dataSource={users}
                columns={columns}
                rowKey="username"
                loading={loading}
                size="small"
            />
        </Space>
    )
}

export default AdminPanel
