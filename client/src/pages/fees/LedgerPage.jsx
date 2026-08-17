import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { feeService } from '../../services';
import { SESSIONS, CURRENT_SESSION } from '../../utils/constants';
import {
    CreditCard, Search, Download, Landmark, Filter, Grid, Activity,
    Briefcase
} from 'lucide-react';

const fmt = (n) => `₦${Number(n || 0).toLocaleString()}`;

export default function LedgerPage() {
    const [session, setSession] = useState(CURRENT_SESSION);
    const [term, setTerm] = useState('');
    const [search, setSearch] = useState('');

    // Fetch all payment records
    const { data: outstandingData = {}, isLoading } = useQuery({
        queryKey: ['fees-outstanding'], // We can use the existing outstanding data or we might need a dedicated endpoint. 
        // Actually, in the plan, I mentioned a new /api/ledger endpoint, but maybe I can use getOutstanding which returns all students?
        // Let's use getOutstanding for now, but it's meant for outstanding. 
        // Wait, the plan said: NEW ledger.controller.js. Did I create it? No.
        // Let's rely on outstandingData.outstanding for outstanding and fully paid.
        // Wait, getOutstanding returns fully paid stats, but doesn't return full paid records in `outstanding`.
        // Let's fetch all payments if possible, but we don't have a get all payments endpoint right now.
        // Let's build a dedicated endpoint or just update getOutstanding to return all records?
        // Let me check fee.controller.js to see what getOutstanding returns.
        queryFn: () => feeService.getOutstanding().then(r => r.data),
    });

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Account Ledger</h1>
                    <p className="page-header-subtitle">Track income across different fee categories (Tuition, Books, Uniform, etc.)</p>
                </div>
            </div>

            <div className="card">
                <h2 style={{ marginBottom: 16 }}>Ledger Tracking is under construction</h2>
                <p className="text-muted">Will display total collections per fee category (e.g. Tuition, Uniforms) to help reconcile Paystack accounts.</p>
            </div>
        </div>
    )
}
