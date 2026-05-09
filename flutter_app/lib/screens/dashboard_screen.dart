import 'package:flutter/material.dart';
import '../services/api_service.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _api = ApiService();
  final _addressController = TextEditingController();

  bool _loading = false;
  Map<String, dynamic>? _depositData;
  Map<String, dynamic>? _stateData;
  String? _error;

  Future<void> _refresh() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final state = await _api.getRollupState();
      Map<String, dynamic>? deposit;
      if (_addressController.text.trim().isNotEmpty) {
        deposit = await _api.getDeposit(_addressController.text.trim());
      }
      setState(() {
        _stateData = state;
        _depositData = deposit;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('ZK Rollup Wallet'),
        backgroundColor: const Color(0xFF1a1a2e),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildSectionTitle('Rollup State'),
            _buildStateCard(),
            const SizedBox(height: 24),
            _buildSectionTitle('My Balance'),
            _buildAddressInput(),
            const SizedBox(height: 12),
            if (_depositData != null) _buildDepositCard(),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(title,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
      );

  Widget _buildStateCard() {
    if (_loading && _stateData == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_stateData == null) return const SizedBox.shrink();
    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _infoRow('Contract', _stateData!['contractAddress'] ?? ''),
            _infoRow('State Root',
                (_stateData!['currentStateRoot'] as String).substring(0, 18) + '...'),
            _infoRow('Total Batches', '${_stateData!['batchCount']}'),
          ],
        ),
      ),
    );
  }

  Widget _buildAddressInput() => Row(
        children: [
          Expanded(
            child: TextField(
              key: const Key('wallet-address-input'),
              controller: _addressController,
              decoration: const InputDecoration(
                labelText: 'Wallet Address (0x...)',
                border: OutlineInputBorder(),
                hintText: '0x...',
              ),
            ),
          ),
          const SizedBox(width: 12),
          ElevatedButton(
            key: const Key('refresh-button'),
            onPressed: _loading ? null : _refresh,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1a1a2e),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            ),
            child: _loading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2))
                : const Text('Refresh'),
          ),
        ],
      );

  Widget _buildDepositCard() => Card(
        elevation: 2,
        color: const Color(0xFFe8f5e9),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _infoRow('Address', _depositData!['address'] ?? ''),
              _infoRow('Balance (ETH)', _depositData!['balanceEth'] ?? '0'),
              _infoRow('Balance (Wei)', _depositData!['balanceWei'] ?? '0'),
            ],
          ),
        ),
      );

  Widget _infoRow(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 140,
              child: Text(label,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, color: Colors.grey)),
            ),
            Expanded(
              child: Text(value,
                  style: const TextStyle(fontFamily: 'monospace')),
            ),
          ],
        ),
      );
}
