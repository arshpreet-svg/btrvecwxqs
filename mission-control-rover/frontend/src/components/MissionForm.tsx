'use client';

import { useState } from 'react';
import { Mission, MissionPriority, MissionPayload } from '@/types';

export default function MissionForm() {
    const [formData, setFormData] = useState<Mission>({
        lat: 0,
        lon: 0,
        payload: 'medical',
        priority: 'medium',
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('http://localhost:5001/mission/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!res.ok) throw new Error('Failed to start mission');

            alert('Mission Started!');
        } catch (error) {
            console.error(error);
            alert('Error starting mission');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 bg-slate-900 text-white rounded-lg shadow-xl border border-slate-700">
            <h2 className="text-xl font-bold mb-4 text-cyan-400">Mission Planner</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-slate-400">Latitude</label>
                        <input
                            type="number"
                            step="any"
                            value={formData.lat}
                            onChange={(e) => setFormData({ ...formData, lat: parseFloat(e.target.value) })}
                            className="w-full bg-slate-800 border border-slate-600 rounded p-2"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400">Longitude</label>
                        <input
                            type="number"
                            step="any"
                            value={formData.lon}
                            onChange={(e) => setFormData({ ...formData, lon: parseFloat(e.target.value) })}
                            className="w-full bg-slate-800 border border-slate-600 rounded p-2"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm text-slate-400">Payload</label>
                    <select
                        value={formData.payload}
                        onChange={(e) => setFormData({ ...formData, payload: e.target.value as MissionPayload })}
                        className="w-full bg-slate-800 border border-slate-600 rounded p-2"
                    >
                        <option value="medical">Medical</option>
                        <option value="supplies">Supplies</option>
                        <option value="rescue">Rescue</option>
                        <option value="investigation">Investigation</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm text-slate-400">Priority</label>
                    <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as MissionPriority })}
                        className="w-full bg-slate-800 border border-slate-600 rounded p-2"
                    >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                    </select>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50"
                >
                    {loading ? 'Initializing...' : 'Start Mission'}
                </button>
            </form>
        </div>
    );
}
