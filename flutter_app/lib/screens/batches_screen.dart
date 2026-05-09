import 'package:flutter/material.dart';
import '../services/api_service.dart';

class BatchesScreen extends StatefulWidget {
  const BatchesScreen({super.key});

  @override
  State<BatchesScreen> createState() => _BatchesScreenState();
}

class _BatchesScreenState extends State<BatchesScreen> {
  final _api = ApiService();

  List<dynamic> _batches = [];
  bool _loading = false;
  String? _error;
  Map<String, dynamic>? _selectedBatchDetail;
  int? _selectedBatchIndex;
  bool _loadingDetail = false;

  @override
  void initState() {
    super.initState();
    _loadBatches();
  }

  Future<void> _loadBatches() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final batches = await _api.getBatches();
      setState(() => _batches = batches);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _loadBatchDetail(int batchIndex) async {
    setState(() {
      _loadingDetail = true;
      _selectedBatchIndex = batchIndex;
      _selectedBatchDetail = null;
    });
    try {
      final detail = await _api.getBatchDetail(batchIndex);
      setState(() => _selectedBatchDetail = detail);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    } finally {
      setState(() => _loadingDetail = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Batch Explorer'),
        backgroundColor: const Color(0xFF1a1a2e),
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadBatches,
          )
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child:
                      Text(_error!, style: const TextStyle(color: Colors.red)))
              : Row(
                  children: [
                    // Batch list
                    SizedBox(
                      width: 320,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(12),
                            color: Colors.grey.shade100,
                            child: Text(
                              '${_batches.length} Batch(es)',
                              style:
                                  const TextStyle(fontWeight: FontWeight.bold),
                            ),
                          ),
                          Expanded(
                            child: _batches.isEmpty
                                ? const Center(
                                    child: Text('No batches committed yet.'))
                                : ListView.separated(
                                    itemCount: _batches.length,
                                    separatorBuilder: (_, __) =>
                                        const Divider(height: 1),
                                    itemBuilder: (context, index) {
                                      final batch = _batches[index]
                                          as Map<String, dynamic>;
                                      final batchIdx =
                                          batch['batch_index'] as int? ?? index;
                                      final isSelected =
                                          _selectedBatchIndex == batchIdx;
                                      return ListTile(
                                        selected: isSelected,
                                        selectedTileColor:
                                            const Color(0xFF1a1a2e)
                                                .withOpacity(0.1),
                                        title: Text('Batch #$batchIdx',
                                            style: const TextStyle(
                                                fontWeight: FontWeight.bold)),
                                        subtitle: Text(
                                          '${batch['tx_count']} txn(s)',
                                          style: const TextStyle(fontSize: 12),
                                        ),
                                        trailing: const Icon(
                                            Icons.chevron_right,
                                            size: 18),
                                        onTap: () =>
                                            _loadBatchDetail(batchIdx),
                                      );
                                    },
                                  ),
                          ),
                        ],
                      ),
                    ),
                    const VerticalDivider(width: 1),
                    // Detail panel
                    Expanded(
                      child: _loadingDetail
                          ? const Center(child: CircularProgressIndicator())
                          : _selectedBatchDetail == null
                              ? const Center(
                                  child: Text('Select a batch to view details'))
                              : _buildDetailPanel(),
                    ),
                  ],
                ),
    );
  }

  Widget _buildDetailPanel() {
    final batch =
        _selectedBatchDetail!['batch'] as Map<String, dynamic>? ?? {};
    final intents =
        _selectedBatchDetail!['intents'] as List<dynamic>? ?? [];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Batch #${batch['batch_index']}',
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          _detailRow('Hash', batch['batch_hash'] ?? ''),
          _detailRow('Tx Count', '${batch['tx_count']}'),
          _detailRow('Relayer', batch['relayer_address'] ?? ''),
          _detailRow('Committed',
              batch['committed_at']?.toString().substring(0, 19) ?? 'Pending'),
          _detailRow('New State Root', batch['new_state_root'] ?? ''),
          const SizedBox(height: 20),
          Text(
            'Included Transactions (${intents.length})',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          if (intents.isEmpty)
            const Text('No transactions in this batch.'),
          ...intents.map((intent) {
            final i = intent as Map<String, dynamic>;
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _detailRow('From', i['from_address'] ?? ''),
                    _detailRow('To', i['to_address'] ?? ''),
                    _detailRow('Amount', '${_formatWei(i['amount_wei'])} ETH'),
                    _detailRow('Status', i['status'] ?? ''),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _detailRow(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 130,
              child: Text(label,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, color: Colors.grey)),
            ),
            Expanded(
              child: Text(value,
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
                  overflow: TextOverflow.ellipsis),
            ),
          ],
        ),
      );

  String _formatWei(dynamic wei) {
    if (wei == null) return '0';
    try {
      final bigWei = BigInt.parse(wei.toString());
      final eth = bigWei / BigInt.from(10).pow(18);
      return eth.toStringAsFixed(4);
    } catch (_) {
      return '0';
    }
  }
}
