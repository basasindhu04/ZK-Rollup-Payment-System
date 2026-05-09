import 'dart:convert';
import 'package:http/http.dart' as http;

const String _defaultBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:4000',
);

class ApiService {
  final String baseUrl;

  ApiService({String? baseUrl}) : baseUrl = baseUrl ?? _defaultBaseUrl;

  Map<String, String> get _headers => {'Content-Type': 'application/json'};

  Future<Map<String, dynamic>> getDeposit(String address) async {
    final response = await http.get(
      Uri.parse('$baseUrl/deposits/$address'),
      headers: _headers,
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    throw Exception('Failed to get deposit: ${response.body}');
  }

  Future<Map<String, dynamic>> getRollupState() async {
    final response = await http.get(
      Uri.parse('$baseUrl/state'),
      headers: _headers,
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    throw Exception('Failed to get rollup state: ${response.body}');
  }

  Future<Map<String, dynamic>> submitIntent(
      String from, String to, String amountWei) async {
    final response = await http.post(
      Uri.parse('$baseUrl/intents'),
      headers: _headers,
      body: jsonEncode({
        'fromAddress': from,
        'toAddress': to,
        'amountWei': amountWei,
      }),
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode == 201) {
      return body;
    }
    throw Exception(body['error'] ?? 'Failed to submit intent');
  }

  Future<List<dynamic>> getIntents({String? address, String? status}) async {
    final params = <String, String>{};
    if (address != null && address.isNotEmpty) params['address'] = address;
    if (status != null && status.isNotEmpty) params['status'] = status;

    final uri = Uri.parse('$baseUrl/intents').replace(queryParameters: params);
    final response = await http.get(uri, headers: _headers);
    if (response.statusCode == 200) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      return body['intents'] as List<dynamic>;
    }
    throw Exception('Failed to get intents: ${response.body}');
  }

  Future<List<dynamic>> getBatches() async {
    final response = await http.get(
      Uri.parse('$baseUrl/batches'),
      headers: _headers,
    );
    if (response.statusCode == 200) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      return body['batches'] as List<dynamic>;
    }
    throw Exception('Failed to get batches: ${response.body}');
  }

  Future<Map<String, dynamic>> getBatchDetail(int batchIndex) async {
    final response = await http.get(
      Uri.parse('$baseUrl/batches/$batchIndex'),
      headers: _headers,
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    throw Exception('Failed to get batch detail: ${response.body}');
  }
}
