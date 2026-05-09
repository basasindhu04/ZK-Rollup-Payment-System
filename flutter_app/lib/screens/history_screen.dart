import 'package:flutter/material.dart';
import '../services/api_service.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  final _api = ApiService();
  final _filterController = TextEditingController();

  List<dynamic> _intents = [];
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadIntents();
  }

  Future<void> _loadIntents() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final addr = _filterController.text.trim();
      final intents = await _api.getIntents(
        address: addr.isNotEmpty ? addr : null,
      );
      setState(() => _intents = intents);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'batched':
      case 'committed':
        return Colors.green;
      case 'pending':
        return Colors.orange;
      case 'failed':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Transaction History'),
        backgroundColor: const Color(0xFF1a1a2e),
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadIntents,
          )
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    key: const Key('history-filter-input'),
                    controller: _filterController,
                    decoration: const InputDecoration(
                      labelText: 'Filter by address',
                      border: OutlineInputBorder(),
                      hintText: '0x...',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onSubmitted: (_) => _loadIntents(),
                  ),
                ),
                const SizedBox(width: 12),
                ElevatedButton(
                  onPressed: _loadIntents,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1a1a2e),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 16),
                  ),
                  child: const Text('Filter'),
                ),
              ],
            ),
          ),
          if (_loading)
            const Expanded(child: Center(child: CircularProgressIndicator()))
          else if (_error != null)
            Expanded(
              child: Center(
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
            )
          else if (_intents.isEmpty)
            const Expanded(
              child: Center(child: Text('No transactions found.')),
            )
          else
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _intents.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final intent = _intents[index] as Map<String, dynamic>;
                  final status = intent['status'] as String? ?? 'unknown';
                  return Card(
                    elevation: 1,
                    child: ListTile(
                      contentPadding: const EdgeInsets.all(12),
                      title: Row(
                        children: [
                          Expanded(
                            child: Text(
                              'To: ${intent['to_address'] ?? ''}',
                              style: const TextStyle(
                                  fontFamily: 'monospace', fontSize: 13),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: _statusColor(status).withOpacity(0.15),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: _statusColor(status)),
                            ),
                            child: Text(
                              status.toUpperCase(),
                              style: TextStyle(
                                  color: _statusColor(status),
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 4),
                          Text(
                            'From: ${intent['from_address'] ?? ''}',
                            style: const TextStyle(
                                fontFamily: 'monospace', fontSize: 12),
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            'Amount: ${_formatWei(intent['amount_wei'])} ETH',
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }

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
