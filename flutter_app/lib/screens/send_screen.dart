import 'package:flutter/material.dart';
import '../services/api_service.dart';

class SendScreen extends StatefulWidget {
  const SendScreen({super.key});

  @override
  State<SendScreen> createState() => _SendScreenState();
}

class _SendScreenState extends State<SendScreen> {
  final _api = ApiService();
  final _fromController = TextEditingController();
  final _toController = TextEditingController();
  final _amountController = TextEditingController();

  bool _loading = false;
  String? _successMessage;
  String? _errorMessage;

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _successMessage = null;
      _errorMessage = null;
    });

    final from = _fromController.text.trim();
    final to = _toController.text.trim();
    final amountEth = _amountController.text.trim();

    if (from.isEmpty || to.isEmpty || amountEth.isEmpty) {
      setState(() {
        _errorMessage = 'All fields are required.';
        _loading = false;
      });
      return;
    }

    try {
      // Convert ETH to Wei (multiply by 10^18)
      final ethVal = double.parse(amountEth);
      final weiVal = BigInt.from((ethVal * 1e18).toInt());

      final result = await _api.submitIntent(from, to, weiVal.toString());
      setState(() {
        _successMessage = 'Intent submitted! ID: ${result['intentId']}';
        _fromController.clear();
        _toController.clear();
        _amountController.clear();
      });
    } catch (e) {
      setState(() => _errorMessage = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Send Payment'),
        backgroundColor: const Color(0xFF1a1a2e),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Submit Payment Intent',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Your payment will be batched and settled on-chain by the relayer.',
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 28),
            TextField(
              controller: _fromController,
              decoration: const InputDecoration(
                labelText: 'From Address',
                border: OutlineInputBorder(),
                hintText: '0x...',
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              key: const Key('to-address-input'),
              controller: _toController,
              decoration: const InputDecoration(
                labelText: 'To Address',
                border: OutlineInputBorder(),
                hintText: '0x...',
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              key: const Key('amount-input'),
              controller: _amountController,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Amount (ETH)',
                border: OutlineInputBorder(),
                hintText: '0.1',
                suffixText: 'ETH',
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              key: const Key('submit-intent-button'),
              onPressed: _loading ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1a1a2e),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                textStyle: const TextStyle(fontSize: 16),
              ),
              child: _loading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : const Text('Send Payment'),
            ),
            const SizedBox(height: 16),
            if (_successMessage != null)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  border: Border.all(color: Colors.green),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(_successMessage!,
                    style: const TextStyle(color: Colors.green)),
              ),
            if (_errorMessage != null)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  border: Border.all(color: Colors.red),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(_errorMessage!,
                    style: const TextStyle(color: Colors.red)),
              ),
          ],
        ),
      ),
    );
  }
}
