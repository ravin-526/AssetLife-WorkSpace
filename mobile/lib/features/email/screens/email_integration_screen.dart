import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:assetlife_mobile/core/api/api_client.dart';
import 'package:assetlife_mobile/core/theme/theme_provider.dart';
import 'package:assetlife_mobile/shared/models/email_sync_models.dart';
import 'package:assetlife_mobile/shared/services/email_integration_service.dart';
import 'package:assetlife_mobile/shared/widgets/app_drawer.dart';

class EmailIntegrationScreen extends StatefulWidget {
  const EmailIntegrationScreen({super.key});

  @override
  State<EmailIntegrationScreen> createState() => _EmailIntegrationScreenState();
}

class _EmailIntegrationScreenState extends State<EmailIntegrationScreen>
    with WidgetsBindingObserver {
  late final EmailIntegrationService _service;
  final _emailController = TextEditingController();

  GmailConnectionStatus? _status;
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _service = EmailIntegrationService(context.read<ApiClient>());
    _loadStatus();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _emailController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadStatus();
    }
  }

  Future<void> _loadStatus() async {
    try {
      final status = await _service.getStatus();
      if (!mounted) return;
      setState(() {
        _status = status;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _connectGmail() async {
    setState(() {
      _busy = true;
    });

    try {
      print("Sending Gmail connect request with source=mobile");
      final response = await _service.connect(email: _emailController.text, source: 'mobile');
      final uri = Uri.tryParse(response.authUrl);
      if (uri == null) {
        throw Exception('Invalid auth URL received from server');
      }

      await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Complete Gmail authorization in browser, then return.',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  Future<void> _disconnectGmail() async {
    setState(() {
      _busy = true;
    });

    try {
      await _service.disconnect();
      await _loadStatus();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Gmail disconnected successfully')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final connected = _status?.connected == true;

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: const Text('Email Integration'),
        actions: [
          Consumer<ThemeProvider>(
            builder: (context, themeProvider, _) => IconButton(
              icon: Icon(
                themeProvider.isDark
                    ? Icons.light_mode_outlined
                    : Icons.dark_mode_outlined,
              ),
              onPressed: themeProvider.toggle,
            ),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Gmail Connection Status',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Container(
                              width: 10,
                              height: 10,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: connected ? Colors.green : Colors.orange,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(connected ? 'Connected' : 'Not Connected'),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text('Mailbox: ${_status?.emailAddress ?? '-'}'),
                        const SizedBox(height: 14),
                        TextField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          decoration: const InputDecoration(
                            labelText: 'Email (optional)',
                            hintText: 'you@example.com',
                          ),
                        ),
                        const SizedBox(height: 14),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            ElevatedButton.icon(
                              onPressed: _busy ? null : _connectGmail,
                              icon: const Icon(Icons.link_outlined),
                              label: Text(
                                _busy ? 'Connecting...' : 'Connect Gmail',
                              ),
                            ),
                            OutlinedButton.icon(
                              onPressed: (_busy || !connected)
                                  ? null
                                  : _disconnectGmail,
                              icon: const Icon(Icons.link_off_outlined),
                              label: const Text('Disconnect Gmail'),
                            ),
                            TextButton(
                              onPressed: _busy ? null : _loadStatus,
                              child: const Text('Refresh Status'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
